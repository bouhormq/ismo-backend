import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  CreateContactAttributes,
  CreateContactBrevoArgs,
  GetEmailEventReportOptions,
  SendMailArgs,
} from 'src/types/mail.types';
import * as SibApiV3Sdk from 'sib-api-v3-typescript';
import { CompanyIncludeType } from 'src/axonaut/utils/mapping';
import { PaginationOptions } from 'src/types/util.types';
import { DatabaseService } from 'src/database/database.service';
import { ZohoService } from 'src/zoho/zoho.service';
import { TransactionalEmailsResponse } from './mail.type';

@Injectable()
export class MailService {
  public apiKey = process.env.BREVO_API_KEY;
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(
    private readonly db: DatabaseService,
    private readonly zohoService: ZohoService,
  ) {
    console.log('BREVO API KEY (first 15 chars):', this.apiKey?.substring(0, 15));
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    this.apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.apiKey,
    );
  }

  public baseApiUrl = 'https://api.brevo.com/v3/smtp/email';

  generateSignatureHtml(user: { signatureImageUrl?: string | null; username?: string }): string {
    const url = user.signatureImageUrl;
    if (url) {
      if (url.startsWith('s3://')) {
        const path = url.replace(/^s3:\/\/[^\/]+\//, '');
        return `${process.env.S3_BASE_URL}/${path}`;
      }
      if (url.startsWith('http')) return url;
      return `${process.env.S3_BASE_URL}/${url}`;
    }
    if (user.username) {
      return `${process.env.S3_BASE_URL}/signatures/${user.username}.png`;
    }
    return '';
  }

  async send(args: SendMailArgs) {
    const CC_ALWAYS = { email: 'ismomat@yahoo.fr' };
    const existingCc = args.cc ?? [];
    const alreadyCc = existingCc.some((c) => c.email === CC_ALWAYS.email);
    const payload: SendMailArgs = {
      ...args,
      cc: alreadyCc ? existingCc : [...existingCc, CC_ALWAYS],
    };
    try {
      await axios.post(this.baseApiUrl, payload, {
        headers: {
          Accept: 'application/json',
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      const axiosError = error as any;
      console.error('Brevo error status:', axiosError?.response?.status);
      console.error('Brevo error body:', JSON.stringify(axiosError?.response?.data));
      console.error('Brevo key prefix:', this.apiKey?.substring(0, 20));
      throw error;
    }
  }

  async checkIfContactExistsInBrevo(email: string) {
    try {
      await axios.get(`https://api.brevo.com/v3/contacts/${email}`, {
        headers: {
          Accept: 'application/json',
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      return true;
    } catch (error) {
      return false;
    }
  }
  async createOrUpdateContact(
    data: Omit<CompanyIncludeType, 'contacts'> & { firstName?: string },
  ) {
    if (!data.email) return;

    const attributes: CreateContactAttributes = {
      NOM: data.companyName,
      PRENOM: data.firstName ? data.firstName : '',
      NOM_DE_LA_SOCIETE: data.companyName,
      PRODUIT_DESIRE: data.desiredItems.map(({ name }) => name).join(', '),
      PRODUIT_UTILISE: data.usedItems.map(({ name }) => name).join(', '),
      POTENTIEL_DE_LA_SOCIETE: data.companyPotential,
      INDUSTRIE: data.industries.map(({ name }) => name).join(', '),
      RUBRIQUE: data.sections.map(({ name }) => name).join(', '),
      CATEGORIE: data.categories.map(({ name }) => name).join(', '),
      CONTACT_ORIGIN: data.contactOrigin?.name,
      PAYS: data.country,
      SMS: data.phoneNumber,
      WHATSAPP: data.phoneNumber,
    };
    try {
      const contactExists = await this.checkIfContactExistsInBrevo(data.email);
      if (contactExists) {
        await this.updateContact({ email: data.email, attributes });
      } else {
        await this.createContact({ email: data.email, attributes });
      }
    } catch (error) {
      throw new HttpException(
        "Couldn't create or update contact",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getEmailEventReport({
    limit,
    offset,
    startDate = '2025-04-09',
    endDate = new Date().toISOString().split('T')[0],
    days,
    email,
    event = 'delivered',
    tags,
    messageId,
    templateId,
  }: GetEmailEventReportOptions) {
    console.log('email', email);
    try {
      const data = (
        await this.apiInstance.getEmailEventReport(
          limit,
          offset,
          startDate,
          endDate,
          days,
          email,
          event,
          tags,
          messageId,
          templateId,
        )
      ).body.events;
      return data;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  private async getEmailDetails({ uuid }: { uuid: string }) {
    try {
      const res = await this.apiInstance.getTransacEmailContent(uuid);
      return res.body;
    } catch (error) {
      console.log('ERROR GETTING EMAIL DETAILS', error);
    }
  }

  async getTransactionEmailLogsWrapper({
    companyId,
    limit,
    offset,
  }: { companyId: string } & PaginationOptions) {
    const company = await this.db.company.findUnique({
      where: { id: Number(companyId) },
      include: { contacts: { select: { email: true } } },
    });

    const emailAddresses = [
      ...(company?.email ? [company.email] : []),
      ...(company?.contacts?.map((c) => c.email).filter(Boolean) ?? []),
    ];
    const uniqueEmails = [...new Set(emailAddresses)];

    const [brevoResults, zohoEmails] = await Promise.all([
      Promise.all(
        uniqueEmails.map((email) =>
          this.getTransactionEmailLogs({ email, limit: '500', offset: '0' }),
        ),
      ),
      company?.zohoContactId
        ? this.zohoService.getContactEmails(company.zohoContactId)
        : Promise.resolve([]),
    ]);

    const brevoResult = {
      data: brevoResults.flatMap((r) => r?.data ?? []),
      count: brevoResults.reduce((sum, r) => sum + (r?.count ?? 0), 0),
    };

    const brevoData = (brevoResult?.data || []).map((e: any) => ({
      ...e,
      source: 'brevo' as const,
    }));

    const zohoData = zohoEmails.map((e: any) => ({
      email: (e.to_mail_ids || []).join(', '),
      subject: e.subject || '',
      templateId: 0,
      messageId: e.email_id || '',
      uuid: e.email_id || '',
      date: e.date || '',
      from: e.from_mail_id || '',
      tags: [e.entity_type === 'invoice' ? 'Facture' : 'Devis'],
      source: 'zoho' as const,
    }));

    const allEmails = [...brevoData, ...zohoData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const paginatedLimit = Number(limit) || 50;
    const paginatedOffset = Number(offset) || 0;
    const paginated = allEmails.slice(paginatedOffset, paginatedOffset + paginatedLimit);

    return { data: paginated, count: allEmails.length };
  }

  async getTransactionEmailLogs({
    email,
    limit,
    offset,
  }: { email: string } & PaginationOptions) {
    try {
      const resRaw = await axios.get<TransactionalEmailsResponse>(
        `https://api.brevo.com/v3/smtp/emails?sort=desc&limit=${limit}&offset=${offset}&templateId=1&email=${email}`,
        { headers: { Accept: 'application/json', 'api-key': this.apiKey } },
      );

      const count = resRaw.data.count;
      const data = resRaw.data.transactionalEmails;

      return { data: data, count };
    } catch (error) {
      console.log('ERROR GETTING LOGS BREVO', error);
    }
  }

  private async createContact(data: CreateContactBrevoArgs) {
    if (!data.email) return;
    try {
      await axios.post<any, unknown, any>(
        'https://api.brevo.com/v3/contacts',
        JSON.stringify(data),
        {
          headers: {
            Accept: 'application/json',
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.log('ERROR CREATING BREVO', error);
    }
  }

  private async updateContact({ email, attributes }: CreateContactBrevoArgs) {
    if (!email) return;

    try {
      await axios.put<any, unknown, any>(
        `https://api.brevo.com/v3/contacts/${email}`,
        JSON.stringify({ attributes }),
        {
          headers: {
            Accept: 'application/json',
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.log('error', error);
    }
  }
}
