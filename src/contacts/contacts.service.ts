import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { GetAllContactsDto } from './dto/get-all-contacts.dto';
import { Prisma, User } from '@prisma/client';
import { UpdateContactDto } from './dto/update-contact.dto';
import { MailService } from 'src/integrations/mail/mail.service';
import { getS3Url, isImage } from 'src/utils/functions/misc.functions';
import { ContactSendEmailsDto } from './dto/contact-send-emails.dto';
import { MediaService } from 'src/media/media.service';
import { ArticlesService } from 'src/articles/articles.service';
import { slugify } from 'src/utils/functions/helper.functions';
import { ZohoService } from 'src/zoho/zoho.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
    private readonly articleService: ArticlesService,
    private readonly mediaService: MediaService,
    private readonly zohoService: ZohoService,
  ) {}

  async createContact(input: CreateContactDto) {
    const { companyId, ...rest } = input;
    const contact = await this.db.contact.create({
      data: {
        ...rest,
        Company: { connect: { id: input.companyId } },
      },
    });

    this._syncCompanyToZoho(input.companyId);

    return contact;
  }

  async getContactOptions(payload: { companyId: string }) {
    const data = await this.db.contact.findMany({
      where: {
        companyId: +payload.companyId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    return data.map(({ id, firstName, lastName }) => ({
      value: id,
      label: `${firstName} ${lastName}`,
    }));
  }

  async getContacts(id: number, payload: GetAllContactsDto) {
    const { order, key, offset, limit, search } = payload;
    const where: Prisma.ContactWhereInput = {
      companyId: id,
    };
    const orderBy: Prisma.ContactOrderByWithRelationInput = {};
    if (key) {
      switch (key) {
        case 'firstName':
          orderBy.firstName = order;
          break;
        case 'lastName':
          orderBy.lastName = order;
          break;
        case 'email':
          orderBy.email = order;
          break;
        case 'phoneNumber':
          orderBy.phoneNumber = order;
          break;
        case 'note':
          orderBy.note = order;
          break;
        case 'functionality':
          orderBy.functionality = order;
          break;
        case 'gender':
          orderBy.gender = order;
          break;
        default:
      }
    }
    if (search) {
      const normalizedSearch = search
        .normalize('NFD') // Decomposes accents
        .replace(/[\u0300-\u036f]/g, '') // Removes accent marks
        .toLowerCase();
      where.OR = [
        {
          firstName: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
          lastName: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
          email: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
          gender:
            normalizedSearch.toLowerCase() === 'madame' ? 'FEMALE' : 'MALE',
        },
      ];
    }
    const data = await this.db.contact.findMany({
      skip: offset * limit,
      take: limit,
      where,
      orderBy,
    });
    const count = await this.db.contact.count();
    return { data, count };
  }

  async updateContact(id: number, input: UpdateContactDto) {
    const contact = await this.db.contact.update({
      where: { id },
      data: input,
    });

    this._syncCompanyToZoho(contact.companyId);

    return contact;
  }

  private _syncCompanyToZoho(companyId: number) {
    this.db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: true,
        industries: true,
        sections: true,
        categories: true,
        contactOrigin: true,
        desiredItems: true,
        usedItems: true,
      },
    }).then((company) => {
      if (company?.zohoContactId) {
        this.zohoService.updateOrRegisterContact(company).catch(() => {});
      }
    }).catch(() => {});
  }

  async getContactById(id: number) {
    return this.db.contact.findUnique({
      where: {
        id,
      },
    });
  }

  async deleteContact(id: number) {
    return this.db.contact.delete({
      where: {
        id,
      },
    });
  }

  async sendEmails(payload: ContactSendEmailsDto, user: User) {
    const {
      object,
      message,
      documents,
      selectedIds,
      articleIds,
      template,
    } = payload;

    const signatureHtml = this.mailService.generateSignatureHtml(user);

    // Generate PDFs for selected articles
    const articleAttachments: { name: string; url: string }[] = [];
    if (articleIds?.length) {
      for (const articleId of articleIds) {
        const article = await this.db.article.findUnique({
          where: { id: articleId },
        });
        if (!article) continue;

        const generatedPdf = await this.articleService.generateArticlePdfs({
          articleIds: [articleId],
        });

        const uploadedPdf = await this.mediaService.uploadFile(
          generatedPdf,
          `${slugify(article.title)}.pdf`,
          'email-documents',
        );

        articleAttachments.push({
          name: article.title,
          url: getS3Url(`${uploadedPdf}`),
        });
      }
    }

    const data = await this.db.contact.findMany({
      where: {
        ...(selectedIds.length ? { AND: [{ id: { in: selectedIds } }] } : {}),
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const allAttachments = [
      ...documents.map(({ name, url }) => ({
        name,
        type: isImage(url) ? 'image' : 'document',
        url: getS3Url(`email-documents/${url}`),
      })),
      ...articleAttachments.map(({ name, url }) => ({
        name,
        type: 'document',
        url,
      })),
    ];

    for (const contact of data) {
      if (contact.email) {
        await this.mailService.send({
          sender: {
            email: 'info@ismomat.fr',
            name: user.name || 'Ismo Mat',
          },
          to: [
            {
              email: contact.email,
              name: `${contact.firstName} ${contact.lastName}`,
            },
          ],
          subject: object,
          htmlContent: `${message}${signatureHtml || user.username === 'najib' ? `<br/><table cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr>${signatureHtml ? `<td style="vertical-align:middle;padding-right:16px;"><img src="${signatureHtml}" style="display:block;max-height:104px;width:auto;" /></td>` : ''}${user.username === 'najib' ? `<td style="vertical-align:middle;"><img src="https://ismo-media.s3.eu-west-3.amazonaws.com/profiles/najib.jpeg" style="display:block;max-height:104px;width:auto;" /></td>` : ''}</tr></table>` : ''}`,
        });
      }
    }

    return true;
  }
}
