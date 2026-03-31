import { BadRequestException, Injectable } from '@nestjs/common';
import { CompanyPotential, Prisma, User } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MailService } from 'src/integrations/mail/mail.service';
import { MediaService } from 'src/media/media.service';
import {
  CompanyPotentialOrder,
  COMPANY_POTENTIAL_OPTIONS,
} from 'src/utils/constants/companies.contants';
import {
  formatContacts,
  formatDocuments,
  slugify,
} from 'src/utils/functions/helper.functions';
import {
  getS3Url,
  isImage,
  transformObject,
} from 'src/utils/functions/misc.functions';
import { CreateCompanyDto } from './dto/create-company.dto';
import { GenerateCompaniesExcelDto } from './dto/generate-excel.dto';
import { GetAllCompaniesReportExcelDto } from './dto/get-all-companies-report-excel.dto';
import { GetAllCompaniesReportDto } from './dto/get-all-companies-report.dto';
import { GetAllCompaniesDto } from './dto/get-all-companies.dto';
import { SendEmailsDto } from './dto/send-emails.dto';
import { SendEmailingDto } from './dto/send-emailing.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { companyTableTransformer } from './entities/company.entity';
import { companyActionReportTableTransformer } from './entities/companyActionReport.entity';
import {
  COMPANIES_HEADERS,
  CONTACTS_HEADERS,
  DetailedCompanyExcelTransformer,
} from './entities/companyExcel.entity';
import { companyReportTableTransformer } from './entities/companyReport.entity';
import {
  COMPANIES_REPORT_HEADERS,
  companyReportExcelTransformer,
} from './entities/companyReportExcel.entity';
import { DetailedCompanyTransformer } from './entities/detailedCompany.entity';
import { formatDate } from 'date-fns';
import { Response } from 'express';
import { GenerateCompaniesPdfDto } from './dto/generate-pdf.dto';
import PDFDocument from 'pdfkit';
import path from 'path';
import { addPagination, calculateTextHeight, drawRoundedRect, keepOnlyPages } from './utils/pdf.functions';
import { COUNTRIES_AND_CITIES, CountryType } from './utils/cities.constants';
import { CreateContactAttributes } from 'src/types/mail.types';
import { ZohoService } from 'src/zoho/zoho.service';
import axios, { AxiosError } from 'axios';
import { ArticlesService } from 'src/articles/articles.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
    private readonly zohoService: ZohoService,
    private readonly articleService: ArticlesService,
    private readonly mediaService: MediaService,
  ) {}

  private async _filterArray(
    key: 'UsedItem' | 'DesiredItem' | 'Industry' | 'Category' | 'Section',
    array: { id?: number; name?: string }[],
    companyId?: number,
  ) {
    const newItems = array.filter(({ name }) => !!name);

    let dbInstance;

    switch (key) {
      case 'UsedItem':
        dbInstance = this.db.usedItem;
        break;
      case 'DesiredItem':
        dbInstance = this.db.desiredItem;
        break;
      case 'Industry':
        dbInstance = this.db.industry;
        break;
      case 'Category':
        dbInstance = this.db.category;
        break;
      case 'Section':
        dbInstance = this.db.section;
        break;
    }

    const existingItemsInDB = await dbInstance.findMany({
      where: {
        companies: { some: { id: companyId } },
      },
    });

    const newItemsInDB = await this.db[key].findMany({
      where: {
        name: {
          in: newItems.map(({ name }) => name),
        },
        companies: { some: {} },
      },
    });

    const newItemsFiltered = newItems.filter(
      ({ name }) =>
        !newItemsInDB.find(
          (item) => item.name.toLowerCase() === name.toLowerCase(),
        ),
    );

    return {
      existing: array.filter(({ id }) => !!id),
      toBeRemoved: existingItemsInDB
        .filter(({ id }) => !array.find(({ id: itemId }) => itemId === id))
        .map(({ id }) => ({ id })),
      new: newItemsFiltered,
    };
  }

  async getCompanyOffers(companyId: string) {
    const company = await this.db.company.findUnique({
      where: { id: Number(companyId) },
    });

    const zohoResult = company.zohoContactId
      ? await this.zohoService.getCompanyOffers(company.zohoContactId)
      : { data: [], count: 0 };

    const data = zohoResult.data.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { data, count: data.length };
  }

  private _generateFilters(payload: GetAllCompaniesDto) {
    const { key, order, search, include: _, ...rest } = payload;

    const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
    const where: Prisma.CompanyWhereInput = {};
    const filters: Prisma.CompanyWhereInput = {};

    const otherOrderBy: {
      latestAction?: { name: Prisma.SortOrder };
    } = {};

    switch (key) {
      case 'companyPotential':
        orderBy.companyPotentialOrder = order;
        break;
      case 'latestAction':
        otherOrderBy.latestAction = { name: order };
        break;
      default:
        orderBy[key] = order;
        break;
    }

    for (const [key, value] of Object.entries(rest)) {
      if (value) {
        switch (key) {
          case 'companyPotential':
            filters.companyPotential = value as CompanyPotential;
            break;
          case 'companyType':
            if (typeof value === 'string')
              filters.companyType = {
                id: { equals: Number(value) },
              };
            break;
          case 'followedBy':
            if (typeof value === 'number') filters.followedBy = { id: value };
            break;
          case 'country':
            if (typeof value === 'string') filters.country = value;
            break;
          case 'city':
            if (typeof value === 'string') filters.city = value;
            break;
          case 'createdAt':
            if (typeof value === 'number') return;
            const hasEndDate = value.split('/').length > 1;

            if (hasEndDate) {
              const [start, end] = value.split('/');

              const startOfDayOfCreatedAt = new Date(start);

              const endOfDayOfCreatedAt = new Date(+new Date(end) + 864e5);

              filters.createdAt = {
                gte: startOfDayOfCreatedAt,
                lt: endOfDayOfCreatedAt,
              };
            } else {
              const startOfDayOfCreatedAt = new Date(value);

              const endOfDayOfCreatedAtDefault = new Date(
                +new Date(value) + 864e5,
              );

              filters.createdAt = {
                gte: startOfDayOfCreatedAt,
                lt: endOfDayOfCreatedAtDefault,
              };
            }
            break;
          case 'updatedAt':
            if (typeof value === 'number') return;
            const hasEndDateUpdatedAt = value.split('/').length > 1;

            if (hasEndDateUpdatedAt) {
              const [start, end] = value.split('/');

              const startOfDayOfUpdatedAt = new Date(start);

              const endOfDayOfUpdatedAt = new Date(+new Date(end) + 864e5);

              filters.updatedAt = {
                gte: startOfDayOfUpdatedAt,
                lt: endOfDayOfUpdatedAt,
              };
            } else {
              const startOfDayOfUpdatedAt = new Date(value);

              const endOfDayOfUpdatedAtDefault = new Date(
                +new Date(value) + 864e5,
              );

              filters.updatedAt = {
                gte: startOfDayOfUpdatedAt,
                lt: endOfDayOfUpdatedAtDefault,
              };
            }
            break;

          case 'lastProspectionCall':
            if (typeof value === 'number') return;
            const hasEndDateLastProspection = value.split('/').length > 1;

            if (hasEndDateLastProspection) {
              const [start, end] = value.split('/');

              const startOfDayOfLastProspection = new Date(start);
              const endOfDayOfLastProspection = new Date(+new Date(end) + 864e5);

              filters.lastProspectionCall = {
                gte: startOfDayOfLastProspection,
                lt: endOfDayOfLastProspection,
              };
            } else {
              const startOfDayOfLastProspection = new Date(value);
              const endOfDayOfLastProspectionDefault = new Date(
                +new Date(value) + 864e5,
              );

              filters.lastProspectionCall = {
                gte: startOfDayOfLastProspection,
                lt: endOfDayOfLastProspectionDefault,
              };
            }
            break;

          case 'contactOrigin':
            filters.contactOrigin = { id: Number(value) };
            break;
          default:
            filters[key] = { some: { id: value } };
            break;
        }
      }
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { contactOrigin: { name: { contains: search, mode: 'insensitive' } } },
        { followedBy: { name: { contains: search, mode: 'insensitive' } } },
        {
          sections: {
            some: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          categories: {
            some: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          actions: {
            some: { object: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }

    return { filters, where, orderBy, otherOrderBy };
  }

  private _generateReportFiltersAction(payload: GetAllCompaniesReportDto) {
    const { key, order, done, ...rest } = payload;

    const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
    const filters: Prisma.ActionWhereInput = {};

    const otherOrderBy: {
      industries?: { name: Prisma.SortOrder };
      categories?: { name: Prisma.SortOrder };
      sections?: { name: Prisma.SortOrder };
      daysSpentInAvailableEquipment?: { name: Prisma.SortOrder };
      daysSpentInNeutral?: { name: Prisma.SortOrder };
      daysSpentInMaterialRequest?: { name: Prisma.SortOrder };
      daysSpentInProjectStudy?: { name: Prisma.SortOrder };
      daysSpentInNegotiation?: { name: Prisma.SortOrder };
      daysSpentInConclusion?: { name: Prisma.SortOrder };
    } = {};

    const actionOrderBy: {
      company?: { companyName: Prisma.SortOrder };
      addedBy?: { name: Prisma.SortOrder };
      actionType?: { name: Prisma.SortOrder };
    } = {};

    switch (key) {
      case 'industry':
        otherOrderBy.industries = { name: order };
        break;
      case 'category':
        otherOrderBy.categories = { name: order };
        break;
      case 'section':
        otherOrderBy.sections = { name: order };
        break;
      case 'companyPotential':
        orderBy.companyPotentialOrder = order;
        break;
      case 'actionType':
        actionOrderBy.actionType = { name: order };
        break;
      case 'addedBy':
        actionOrderBy.addedBy = { name: order };
        break;
      case 'companyName':
        actionOrderBy.company = { companyName: order };
        break;
      case 'daysSpentInAvailableEquipment':
        otherOrderBy.daysSpentInAvailableEquipment = { name: order };
        break;
      case 'daysSpentInNeutral':
        otherOrderBy.daysSpentInNeutral = { name: order };
        break;
      case 'daysSpentInMaterialRequest':
        otherOrderBy.daysSpentInMaterialRequest = { name: order };
        break;
      case 'daysSpentInProjectStudy':
        otherOrderBy.daysSpentInProjectStudy = { name: order };
        break;
      case 'daysSpentInNegotiation':
        otherOrderBy.daysSpentInNegotiation = { name: order };
        break;
      case 'daysSpentInConclusion':
        otherOrderBy.daysSpentInConclusion = { name: order };
        break;

      default:
        orderBy[key] = order;
        break;
    }

    for (const [key, value] of Object.entries(rest)) {
      if (value) {
        switch (key) {
          case 'industries':
            if (typeof value === 'number')
              filters.company = { industries: { some: { id: value } } };
            break;
          case 'categories':
            if (typeof value === 'number')
              filters.company = { categories: { some: { id: value } } };
            break;
          case 'sections':
            if (typeof value === 'number')
              filters.company = { sections: { some: { id: value } } };
            break;
          case 'companyName':
            if (typeof value === 'number') {
              filters.companyId = {
                equals: value,
              };
            }
            break;
          case 'companyPotential':
            filters.company = {
              companyPotential: { equals: value as CompanyPotential },
            };
            break;
          case 'actionType':
            if (typeof value === 'number')
              filters.actionType = {
                id: value,
              };
            break;
          case 'addedBy':
            if (typeof value === 'number')
              filters.addedBy = {
                id: value,
              };
            break;
          case 'object':
            filters.object = {
              equals: value as string,
            };
            break;

          case 'startDateRange':
            if (typeof value !== 'string') break;
            const [startDateRangeStart, startDateRangeEnd] = value.split('/');
            filters.startDate = {
              gte: new Date(startDateRangeStart),
              lte: new Date(
                new Date(startDateRangeEnd).setHours(23, 59, 59, 999),
              ),
            };
            break;
          case 'endDateRange':
            if (typeof value !== 'string') break;

            const [endDateRangeStart, endDateRangeEnd] = value.split('/');

            filters.endDate = {
              gte: new Date(endDateRangeStart),
              lte: new Date(
                new Date(endDateRangeEnd).setHours(23, 59, 59, 999),
              ),
            };
            break;
          default:
            break;
        }
      }
    }

    return { filters, orderBy, otherOrderBy, actionOrderBy };
  }
  private _generateReportFilters(
    payload: GetAllCompaniesReportDto,
    mode: 'companies' | 'actions',
  ) {
    const { key, order, done, ...rest } = payload;

    const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
    const filters: Prisma.CompanyWhereInput = {};

    const otherOrderBy: {
      industries?: { name: Prisma.SortOrder };
      categories?: { name: Prisma.SortOrder };
      sections?: { name: Prisma.SortOrder };
      daysSpentInAvailableEquipment?: { name: Prisma.SortOrder };
      daysSpentInNeutral?: { name: Prisma.SortOrder };
      daysSpentInMaterialRequest?: { name: Prisma.SortOrder };
      daysSpentInProjectStudy?: { name: Prisma.SortOrder };
      daysSpentInNegotiation?: { name: Prisma.SortOrder };
      daysSpentInConclusion?: { name: Prisma.SortOrder };
    } = {};

    const actionOrderBy: {
      company?: { companyName: Prisma.SortOrder };
      addedBy?: { name: Prisma.SortOrder };
      actionType?: { name: Prisma.SortOrder };
    } = {};

    switch (key) {
      case 'industry':
        otherOrderBy.industries = { name: order };
        break;
      case 'category':
        otherOrderBy.categories = { name: order };
        break;
      case 'section':
        otherOrderBy.sections = { name: order };
        break;
      case 'companyPotential':
        orderBy.companyPotentialOrder = order;
        break;
      case 'actionType':
        actionOrderBy.actionType = { name: order };
        break;
      case 'addedBy':
        actionOrderBy.addedBy = { name: order };
        break;
      case 'companyName':
        if (mode === 'companies') orderBy.companyName = order;
        else actionOrderBy.company = { companyName: order };
        break;
      case 'daysSpentInAvailableEquipment':
        otherOrderBy.daysSpentInAvailableEquipment = { name: order };
        break;
      case 'daysSpentInNeutral':
        otherOrderBy.daysSpentInNeutral = { name: order };
        break;
      case 'daysSpentInMaterialRequest':
        otherOrderBy.daysSpentInMaterialRequest = { name: order };
        break;
      case 'daysSpentInProjectStudy':
        otherOrderBy.daysSpentInProjectStudy = { name: order };
        break;
      case 'daysSpentInNegotiation':
        otherOrderBy.daysSpentInNegotiation = { name: order };
        break;
      case 'daysSpentInConclusion':
        otherOrderBy.daysSpentInConclusion = { name: order };
        break;
      default:
        orderBy[key] = order;
        break;
    }

    for (const [key, value] of Object.entries(rest)) {
      if (value) {
        switch (key) {
          case 'industries':
            if (typeof value === 'number')
              filters.industries = { some: { id: value } };
            break;
          case 'categories':
            if (typeof value === 'number')
              filters.categories = { some: { id: value } };
            break;
          case 'sections':
            if (typeof value === 'number')
              filters.sections = { some: { id: value } };
            break;
          case 'companyName':
            if (typeof value === 'number') {
              if (mode === 'companies') {
                filters.id = value;
              } else {
                filters.actions = {
                  some: {
                    companyId: value,
                  },
                };
              }
            }
            break;
          case 'companyPotential':
            filters.companyPotential = value as CompanyPotential;
            break;
          case 'actionType':
            if (typeof value === 'number')
              filters.actions = {
                some: {
                  actionType: {
                    id: value,
                  },
                },
              };
            break;
          case 'addedBy':
            if (typeof value === 'number')
              filters.actions = {
                some: {
                  addedBy: {
                    id: value,
                  },
                },
              };
            break;
          case 'object':
            filters.actions = {
              some: {
                object: {
                  equals: value as string,
                },
              },
            };
            break;
          case 'startDate':
            filters.actions = {
              some: {
                startDate: {
                  gte: new Date(value),
                },
              },
            };
            break;
          case 'endDate':
            filters.actions = {
              some: {
                endDate: {
                  lte: new Date(value),
                },
              },
            };
            break;
          default:
            break;
        }
      }
    }

    return { filters, orderBy, otherOrderBy, actionOrderBy };
  }

  private async _generateCompaniesForReport(payload: GetAllCompaniesReportDto) {
    const { offset, limit, ...rest } = payload;

    const { filters, orderBy, otherOrderBy } = this._generateReportFilters(
      rest,
      'companies',
    );

    const data = await this.db.company.findMany({
      skip: offset && limit ? offset * limit : 0,
      take: limit,
      where: filters,
      orderBy,
      include: {
        categories: true,
        industries: true,
        sections: true,
        companyPotentialUpdateLogs: true,
      },
    });

    const count = await this.db.company.count({
      where: filters,
    });

    return { data, count, otherOrderBy };
  }

  private filtersMapper(obj: { id: number; name: string }[]) {
    return obj.map(({ id, name }) => ({ value: id, label: name }));
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const {
      code,
      companyPotential,
      followedBy,
      usedItems,
      desiredItems,
      contactOrigin,
      companyType,
      industries,
      categories,
      sections,
      lastProspectionCall,
      ...data
    } = createCompanyDto;

    const filteredOptions = {
      usedItems: await this._filterArray('UsedItem', usedItems),
      desiredItems: await this._filterArray('DesiredItem', desiredItems),
      industries: await this._filterArray('Industry', industries),
      categories: await this._filterArray('Category', categories),
      sections: await this._filterArray('Section', sections),
    };

    const companyTypeExists = companyType
      ? await this.db.companyType.findFirst({
          where: { name: companyType.name },
        })
      : undefined;

    const contactOriginExists = contactOrigin
      ? await this.db.contactOrigin.findFirst({
          where: { name: contactOrigin.name },
        })
      : undefined;

    const newCompany = await this.db.company.create({
      data: {
        ...data,
        code: code ?? '',
        companyPotential,
        companyPotentialOrder: CompanyPotentialOrder[companyPotential],
        ...(lastProspectionCall ? { lastProspectionCall: new Date(lastProspectionCall) } : {}),

        companyPotentialUpdateLogs: { create: { companyPotential } },

        ...(followedBy && { followedBy: { connect: { id: followedBy } } }),

        ...(companyType && {
          companyType: companyType.name
            ? companyTypeExists
              ? {
                  connect: { id: companyTypeExists.id },
                }
              : { create: { name: companyType.name } }
            : { connect: { id: companyType.id } },
        }),

        ...(contactOrigin && {
          contactOrigin: contactOrigin.name
            ? contactOriginExists
              ? {
                  connect: { id: contactOriginExists.id },
                }
              : { create: { name: contactOrigin.name } }
            : { connect: { id: contactOrigin.id } },
        }),

        usedItems: {
          connect: filteredOptions.usedItems.existing.map(({ id }) => ({ id })),
          create: filteredOptions.usedItems.new.map(({ name }) => ({ name })),
        },
        desiredItems: {
          connect: filteredOptions.desiredItems.existing.map(({ id }) => ({
            id,
          })),
          create: filteredOptions.desiredItems.new.map(({ name }) => ({
            name,
          })),
        },
        industries: {
          connect: filteredOptions.industries.existing.map(({ id }) => ({
            id,
          })),
          create: filteredOptions.industries.new.map(({ name }) => ({ name })),
        },
        categories: {
          connect: filteredOptions.categories.existing.map(({ id }) => ({
            id,
          })),
          create: filteredOptions.categories.new.map(({ name }) => ({ name })),
        },
        sections: {
          connect: filteredOptions.sections.existing.map(({ id }) => ({ id })),
          create: filteredOptions.sections.new.map(({ name }) => ({ name })),
        },
      },
      include: {
        companyType: true,
        industries: true,
        sections: true,
        categories: true,
        contactOrigin: true,
        desiredItems: true,
        usedItems: true,
        contacts: true,
      },
    });

    const updateCompany = newCompany.companyType
      ? await this.db.company.update({
          where: { id: newCompany.id },
          data: {
            code: `${newCompany.companyType.name.substring(0, 2).toUpperCase()}${newCompany.id}`,
          },
          include: {
            industries: true,
            sections: true,
            categories: true,
            contactOrigin: true,
            desiredItems: true,
            usedItems: true,
            contacts: true,
          },
        })
      : newCompany;

    await this.zohoService.updateOrRegisterContact(updateCompany);
    await this.mailService.createOrUpdateContact(updateCompany);
    return updateCompany;
  }

  async findAllCompanyOptions() {
    const companies = await this.db.company.findMany({
      select: {
        id: true,
        companyName: true,
      },
    });

    return companies.map(({ id, companyName }) => ({
      value: id,
      label: companyName,
    }));
  }

  async findAll(payload: GetAllCompaniesDto) {
    const { offset, limit, ...rest } = payload;

    const { filters, where, orderBy, otherOrderBy } =
      this._generateFilters(rest);

    const hasOrderByNotUndefined = !!Object.keys(orderBy).find(
      (key) => orderBy[key] !== undefined,
    );
    const data = await this.db.company.findMany({
      skip: offset && limit ? offset * limit : 0,
      take: limit,
      where: {
        AND: [filters, ...(!!Object.keys(where).length ? [where] : [])],

        // contactOrigin: {
        //   name: { contains: 'ZEKRI', mode: 'insensitive' },
        // },
      },
      orderBy: hasOrderByNotUndefined
        ? orderBy
        : {
            updatedAt: 'desc',
          },
      include: {
        categories: true,
        contactOrigin: true,
        followedBy: true,
        industries: true,
        sections: true,
        actions: {
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    });

    const count = await this.db.company.count({
      where: {
        AND: [filters, ...(!!Object.keys(where).length ? [where] : [])],
      },
    });

    const companies = transformObject(data, companyTableTransformer);

    const sort = (key: string) => {
      const order = otherOrderBy[key].name === 'asc' ? 'asc' : 'desc';

      companies.sort((a, b) =>
        a[key] > b[key] ? 1 : b[key] > a[key] ? -1 : 0,
      );

      if (order === 'desc') companies.reverse();
    };

    if (otherOrderBy.latestAction) sort('latestAction');

    return { data: companies, count };
  }

  async getAllCompaniesReport(payload: GetAllCompaniesReportDto) {
    const { data, count, otherOrderBy } =
      await this._generateCompaniesForReport(payload);

    const {
      industries,
      categories,
      sections,
      daysSpentInAvailableEquipment,
      daysSpentInConclusion,
      daysSpentInMaterialRequest,
      daysSpentInNegotiation,
      daysSpentInNeutral,
      daysSpentInProjectStudy,
    } = otherOrderBy;

    const companies = transformObject(data, companyReportTableTransformer);

    const sort = (key: string) => {
      const order = otherOrderBy[key].name === 'asc' ? 'asc' : 'desc';

      companies.sort((a, b) =>
        a[key] > b[key] ? 1 : b[key] > a[key] ? -1 : 0,
      );

      if (order === 'desc') companies.reverse();
    };

    if (industries) sort('industries');
    if (categories) sort('categories');
    if (sections) sort('sections');
    if (daysSpentInAvailableEquipment) sort('daysSpentInAvailableEquipment');
    if (daysSpentInConclusion) sort('daysSpentInConclusion');
    if (daysSpentInMaterialRequest) sort('daysSpentInMaterialRequest');
    if (daysSpentInNegotiation) sort('daysSpentInNegotiation');
    if (daysSpentInNeutral) sort('daysSpentInNeutral');
    if (daysSpentInProjectStudy) sort('daysSpentInProjectStudy');

    return {
      data: companies,
      count,
    };
  }

  async getAllCompaniesActionsReport(payload: GetAllCompaniesReportDto) {
    const { offset, limit, ...rest } = payload;

    const { filters, orderBy, actionOrderBy } =
      this._generateReportFiltersAction(rest);
    let isDone = undefined;
    if (rest.done !== undefined) {
      isDone = rest.done;
    }
    const data = await this.db.action.findMany({
      skip: offset && limit ? offset * limit : 0,
      take: limit,
      where: { ...filters, isDone: isDone },
      orderBy: {
        ...orderBy,
        ...actionOrderBy,
      },
      include: {
        addedBy: {
          select: {
            name: true,
          },
        },
        actionType: {
          select: {
            name: true,
          },
        },
        company: {
          select: {
            companyName: true,
          },
        },
      },
    });

    const actionsCount = data.length;

    return {
      data: transformObject(data, companyActionReportTableTransformer),
      count: actionsCount,
    };
  }

  async findOne(id: number) {
    const company = await this.db.company.findUnique({
      where: { id },
      include: {
        categories: { select: { id: true, name: true } },
        contactOrigin: { select: { id: true, name: true } },
        followedBy: { select: { id: true, name: true } },
        industries: { select: { id: true, name: true } },
        sections: { select: { id: true, name: true } },
        usedItems: { select: { id: true, name: true } },
        desiredItems: { select: { id: true, name: true } },
        companyType: { select: { id: true, name: true } },
        documents: true,
      },
    });

    return DetailedCompanyTransformer(company);
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto) {
    const {
      followedBy,
      companyPotential,
      usedItems,
      desiredItems,
      contactOrigin,
      industries,
      categories,
      sections,
      contacts,
      documents,
      companyType,
      lastProspectionCall,
      ...data
    } = updateCompanyDto;

    const filteredOptions = {
      usedItems: await this._filterArray('UsedItem', usedItems),
      desiredItems: await this._filterArray('DesiredItem', desiredItems),
      industries: await this._filterArray('Industry', industries),
      categories: await this._filterArray('Category', categories),
      sections: await this._filterArray('Section', sections),
      documents: formatDocuments(documents ?? []),
      contacts: formatContacts(contacts ?? []),
    };

    const companyTypeExists = companyType
      ? await this.db.companyType.findFirst({
          where: { name: companyType.name, companies: { some: {} } },
        })
      : undefined;

    const contactOriginExists = contactOrigin
      ? await this.db.contactOrigin.findFirst({
          where: { name: contactOrigin.name, companies: { some: {} } },
        })
      : undefined;

    const updatedCompany = await this.db.$transaction(
      async (ax) => {
        const companyToUpdate = await ax.company.findUnique({
          where: { id },
          select: {
            categories: true,
            companyPotential: true,
            companyPotentialUpdateLogs: true,
            companyTypeId: true,
            contactOriginId: true,
            userId: true,
            contacts: true,
          },
        });

        const hasNewCp = companyToUpdate.companyPotential !== companyPotential;

        const existingCp = companyToUpdate.companyPotentialUpdateLogs.find(
          (log) => log.companyPotential === companyPotential,
        );

        const company = await ax.company.update({
          where: { id },
          data: {
            ...data,
            ...(lastProspectionCall !== undefined && {
              lastProspectionCall: lastProspectionCall ? new Date(lastProspectionCall) : null,
            }),
            ...(hasNewCp
              ? {
                  companyPotential,
                  companyPotentialOrder:
                    CompanyPotentialOrder[companyPotential],
                }
              : {}),

            companyPotentialUpdateLogs: {
              ...(existingCp
                ? {
                    update: {
                      where: { id: existingCp.id },
                      data: {
                        time: {
                          increment:
                            new Date().getTime() -
                            existingCp.updatedAt.getTime(),
                        },
                      },
                    },
                  }
                : { create: { companyPotential } }),
            },

            ...(companyType
              ? {
                  companyType: companyType.name
                    ? companyTypeExists
                      ? {
                          connect: { id: companyTypeExists.id },
                        }
                      : { create: { name: companyType.name } }
                    : { connect: { id: companyType.id } },
                }
              : companyToUpdate.companyTypeId
                ? {
                    companyType: {
                      disconnect: { id: companyToUpdate.companyTypeId },
                    },
                  }
                : {}),

            ...(contactOrigin
              ? {
                  contactOrigin: contactOrigin.name
                    ? contactOriginExists
                      ? {
                          connect: { id: contactOriginExists.id },
                        }
                      : { create: { name: contactOrigin.name } }
                    : { connect: { id: contactOrigin.id } },
                }
              : companyToUpdate.contactOriginId
                ? {
                    contactOrigin: {
                      disconnect: { id: companyToUpdate.contactOriginId },
                    },
                  }
                : {}),

            ...(followedBy
              ? { followedBy: { connect: { id: followedBy } } }
              : companyToUpdate.userId
                ? {
                    followedBy: {
                      disconnect: { id: companyToUpdate.userId },
                    },
                  }
                : {}),

            usedItems: {
              disconnect: filteredOptions.usedItems.toBeRemoved.map(
                ({ id }) => ({
                  id,
                }),
              ),
              connect: filteredOptions.usedItems.existing.map(({ id }) => ({
                id,
              })),
              create: filteredOptions.usedItems.new.map(({ name }) => ({
                name,
              })),
            },
            desiredItems: {
              disconnect: filteredOptions.desiredItems.toBeRemoved.map(
                ({ id }) => ({ id }),
              ),
              connect: filteredOptions.desiredItems.existing.map(({ id }) => ({
                id,
              })),
              create: filteredOptions.desiredItems.new.map(({ name }) => ({
                name,
              })),
            },
            industries: {
              disconnect: filteredOptions.industries.toBeRemoved.map(
                ({ id }) => ({
                  id,
                }),
              ),
              connect: filteredOptions.industries.existing.map(({ id }) => ({
                id,
              })),
              create: filteredOptions.industries.new.map(({ name }) => ({
                name,
              })),
            },
            categories: {
              disconnect: filteredOptions.categories.toBeRemoved.map(
                ({ id }) => ({ id }),
              ),
              connect: filteredOptions.categories.existing.map(({ id }) => ({
                id,
              })),
              create: filteredOptions.categories.new.map(({ name }) => ({
                name,
              })),
            },
            sections: {
              disconnect: filteredOptions.sections.toBeRemoved.map(
                ({ id }) => ({
                  id,
                }),
              ),
              connect: filteredOptions.sections.existing.map(({ id }) => ({
                id,
              })),
              create: filteredOptions.sections.new.map(({ name }) => ({
                name,
              })),
            },
            contacts: {
              deleteMany: filteredOptions.contacts.toBeDeleted.map(
                ({ id }) => ({ id }),
              ),
              createMany: {
                data: filteredOptions.contacts.toBeAdded.map((contact) => ({
                  ...contact,
                  companyId: id,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email,
                  phoneNumber: contact.phoneNumber,
                  gender: contact.gender,
                })),
              },
              connect: filteredOptions.contacts.toBeUpdated.map(({ id }) => ({
                id,
              })),
            },
          },
          include: {
            categories: true,
            contactOrigin: true,
            followedBy: true,
            industries: true,
            sections: true,
            usedItems: true,
            desiredItems: true,
            companyType: true,
            contacts: true,
          },
        });

        if (
          company.companyType ||
          (companyToUpdate.companyTypeId && !company.companyType)
        )
          await ax.company.update({
            where: { id },
            data: {
              code: company.companyType
                ? `${company.companyType.name.substring(0, 2).toUpperCase()}${company.id}`
                : '',
              updatedAt: new Date(),
            },
          });

        await Promise.all(
          filteredOptions.documents.toBeUpdated.map(async (doc) => {
            await this.db.document.update({
              where: { id: doc.id },
              data: {
                name: doc.name,
                description: doc.description,
                url: doc.url,
              },
            });
          }),
        );
        await Promise.all(
          filteredOptions.documents.toBeAdded.map(async (doc) => {
            await this.db.document.create({
              data: {
                name: doc.name,
                description: doc.description,
                url: doc.url,
                companyId: id,
              },
            });
          }),
        );

        await Promise.all(
          filteredOptions.documents.toBeDeleted.map(async (doc) => {
            await this.db.document.delete({ where: { id: doc.id } });
          }),
        );

        return company;
      },
      {
        timeout: 10000,
      },
    );

    await this.zohoService.updateOrRegisterContact(updatedCompany);
    await this.mailService.createOrUpdateContact(updatedCompany);

    const companyContacts = await this.db.contact.findMany({
      where: {
        companyId: id,
      },
    });

    for (const contact of companyContacts) {
      await this.mailService.createOrUpdateContact({
        ...updatedCompany,
        email: contact.email,
        firstName: `${contact.firstName} - ${contact.functionality}`,
      });
    }

    return DetailedCompanyTransformer(updatedCompany);
  }

  async syncZohoContact(id: number): Promise<{ zohoContactId: string | null }> {
    const company = await this.db.company.findUnique({
      where: { id },
      include: {
        industries: true,
        sections: true,
        categories: true,
        contactOrigin: true,
        desiredItems: true,
        usedItems: true,
        contacts: true,
      },
    });

    if (!company) throw new Error('Company not found');

    await this.zohoService.updateOrRegisterContact(company);

    const updated = await this.db.company.findUnique({
      where: { id },
      select: { zohoContactId: true },
    });

    return { zohoContactId: updated?.zohoContactId ?? null };
  }

  remove(id: number) {
    return this.db.company.delete({ where: { id } });
  }

  async removeCategory(id: number) {
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) throw new BadRequestException('Category not found');

    await this.db.article.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    await this.db.category.update({
      where: { id },
      data: { companies: { set: [] } },
    });

    return this.db.category.delete({ where: { id } });
  }

  async removeSection(id: number) {
    const section = await this.db.section.findUnique({ where: { id } });
    if (!section) throw new BadRequestException('Section not found');

    await this.db.section.update({
      where: { id },
      data: { companies: { set: [] }, articles: { set: [] } },
    });

    return this.db.section.delete({ where: { id } });
  }

  async removeIndustry(id: number) {
    const industry = await this.db.industry.findUnique({ where: { id } });
    if (!industry) throw new BadRequestException('Industry not found');

    await this.db.industry.update({
      where: { id },
      data: { companies: { set: [] }, articles: { set: [] } },
    });

    return this.db.industry.delete({ where: { id } });
  }

  async getFilterOptions() {
    const res = await Promise.allSettled([
      this.db.category.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.contactOrigin.findMany({ orderBy: { name: 'asc' } }),
      this.db.industry.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.section.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.user.findMany({ orderBy: { name: 'asc' } }),
      this.db.usedItem.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.desiredItem.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.user.findMany({ orderBy: { name: 'asc' } }),
      this.db.companyType.findMany({ orderBy: { name: 'asc' } }),
    ]);
    const [
      categories,
      contactOrigins,
      industries,
      sections,
      followedBy,
      usedItems,
      desiredItems,
      users,
      companyTypes,
    ] = res.map((data) => (data.status === 'fulfilled' ? data.value : []));

    const companies = await this.db.company.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const actions = await this.db.action.findMany({
      include: {
        actionType: true,
        addedBy: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      categories: this.filtersMapper(categories),
      contactOrigin: this.filtersMapper(contactOrigins),
      industries: this.filtersMapper(industries),
      sections: this.filtersMapper(sections),
      followedBy: this.filtersMapper(followedBy),
      usedItems: this.filtersMapper(usedItems),
      desiredItems: this.filtersMapper(desiredItems),
      users: this.filtersMapper(users),
      companyTypes: this.filtersMapper(companyTypes),
      companies: companies.map(({ id, companyName }) => ({
        value: id,
        label: companyName,
      })),
      companiesPotentials: Array.from(
        new Map(
          companies.map(({ companyPotential }) => [
            companyPotential,
            companyPotential,
          ]),
        ).values(),
      ).map((companyPotential) => ({
        value: companyPotential,
        label: COMPANY_POTENTIAL_OPTIONS[companyPotential],
      })),
      actionsTypes: Array.from(
        new Map(
          actions.map(({ actionType }) => [actionType.id, actionType]),
        ).values(),
      ).map(({ id, name }) => ({
        value: id,
        label: name,
      })),
      addedBy: Array.from(
        new Map(actions.map(({ addedBy }) => [addedBy.id, addedBy])).values(),
      ).map(({ id, name }) => ({
        value: id,
        label: name,
      })),
      objects: Array.from(new Set(actions.map(({ object }) => object))).map(
        (object) => ({
          value: object,
          label: object,
        }),
      ),
    };
  }

  async generateCompanyReportExcelData(payload: GetAllCompaniesReportExcelDto) {
    const { data, otherOrderBy } =
      await this._generateCompaniesForReport(payload);

    const {
      industries,
      categories,
      sections,
      daysSpentInAvailableEquipment,
      daysSpentInConclusion,
      daysSpentInMaterialRequest,
      daysSpentInNegotiation,
      daysSpentInNeutral,
      daysSpentInProjectStudy,
    } = otherOrderBy;

    const companies = transformObject(data, companyReportExcelTransformer);

    const sort = (key: string) => {
      const order = otherOrderBy[key].name === 'asc' ? 'asc' : 'desc';

      companies.sort((a, b) =>
        a[key] > b[key] ? 1 : b[key] > a[key] ? -1 : 0,
      );

      if (order === 'desc') companies.reverse();
    };

    if (industries) sort('industries');
    if (categories) sort('categories');
    if (sections) sort('sections');
    if (daysSpentInAvailableEquipment) sort('daysSpentInAvailableEquipment');
    if (daysSpentInConclusion) sort('daysSpentInConclusion');
    if (daysSpentInMaterialRequest) sort('daysSpentInMaterialRequest');
    if (daysSpentInNegotiation) sort('daysSpentInNegotiation');
    if (daysSpentInNeutral) sort('daysSpentInNeutral');
    if (daysSpentInProjectStudy) sort('daysSpentInProjectStudy');

    return {
      dataSheets: {
        companies: {
          headers: COMPANIES_REPORT_HEADERS,
          data: companies,
        },
      },
    };
  }

  async generateCompanyActionsExcelData(
    payload: GetAllCompaniesReportExcelDto,
  ) {
    const data = await this.getAllCompaniesActionsReport(payload);

    return {
      dataSheets: {
        actions: {
          headers: {
            companyName: 'Société',
            actionType: "Type d'action",
            addedBy: 'Fait Par',
            startDate: 'Date de début',
            endDate: 'Date de fin',
            object: 'Objet',
            isDone: 'Fait',
          },
          data: data.data.map((action) => ({
            ...action,
            startDate: formatDate(action.startDate, 'dd/MM/yyyy'),
            endDate: formatDate(action.endDate, 'dd/MM/yyyy'),
            isDone: action.isDone ? 'Oui' : 'Non',
          })),
        },
      },
    };
  }

  async generateExcelData(payload: GenerateCompaniesExcelDto) {
    const { selectedIds, ...rest } = payload;

    const { filters, where } = this._generateFilters(rest);

    const data = await this.db.company.findMany({
      where: {
        AND: [
          ...(!!selectedIds.length ? [{ id: { in: selectedIds } }] : []),
          filters,
          ...(!!Object.keys(where).length ? [where] : []),
        ],
      },
      select: {
        companyName: true,
        phoneNumber: true,
        code: true,
        email: true,
        address: true,
        compl: true,
        activityDescription: true,
        siret: true,
        vatNumber: true,
        website: true,
        zipCode: true,
        city: true,
        country: true,
        companyType: { select: { name: true } },
        companyPotential: true,
        followedBy: { select: { name: true } },
        contactOrigin: { select: { name: true } },
        usedItems: { select: { name: true } },
        desiredItems: { select: { name: true } },
        industries: { select: { name: true } },
        categories: { select: { name: true } },
        sections: { select: { name: true } },
        contacts: {
          select: {
            gender: true,
            firstName: true,
            lastName: true,
            email: true,
            functionality: true,
            note: true,
            phoneNumber: true,
            hasWhatsapp: true,
          },
        },
      },
    });

    const transformedData = transformObject(
      data,
      DetailedCompanyExcelTransformer,
    );

    const maxContacts = Math.max(
      ...transformedData.map(({ contacts }) => contacts.length),
    );

    const companiesData = transformedData.map(({ contacts, ...company }) => ({
      ...company,
      ...contacts.reduce(
        (acc, contact, index) => ({
          ...acc,
          [`Contact ${index + 1}_firstName`]: contact.firstName,
          [`Contact ${index + 1}_lastName`]: contact.lastName,
          [`Contact ${index + 1}_email`]: contact.email,
          [`Contact ${index + 1}_gender`]: contact.gender,
          [`Contact ${index + 1}_functionality`]: contact.functionality,
          [`Contact ${index + 1}_phoneNumber`]: contact.phoneNumber,
          [`Contact ${index + 1}_note`]: contact.note,
          [`Contact ${index + 1}_hasWhatsapp`]: contact.hasWhatsapp,
        }),
        {},
      ),
    }));

    const GENERATED_HEADERS = {
      ...COMPANIES_HEADERS,
      ...Array.from({ length: maxContacts }).reduce<Record<string, string>>(
        (acc, _, index) => {
          acc[`Contact ${index + 1}_firstName`] = `Contact ${index + 1} Prénom`;
          acc[`Contact ${index + 1}_lastName`] = `Contact ${index + 1} Nom`;
          acc[`Contact ${index + 1}_email`] = `Contact ${index + 1} Email`;
          acc[`Contact ${index + 1}_gender`] = `Contact ${index + 1} Civilitie`;
          acc[`Contact ${index + 1}_functionality`] =
            `Contact ${index + 1} Fonctionnalité`;
          acc[`Contact ${index + 1}_phoneNumber`] = `Contact ${index + 1} GSM`;
          acc[`Contact ${index + 1}_note`] = `Contact ${index + 1} Note`;
          acc[`Contact ${index + 1}_hasWhatsapp`] =
            `Contact ${index + 1} Whatsapp`;
          return acc;
        },
        {} as Record<string, string>,
      ),
    };

    // const contactsData = transformedData
    //   .map(({ contacts }) => contacts)
    //   .reduce((acc, contacts) => {
    //     if (!contacts.length) return acc;
    //     return {
    //       ...acc,
    //       [`Contacts - ${contacts[0].companyName}`]: {
    //         headers: CONTACTS_HEADERS,
    //         data: contacts.map(({ companyName: _, ...contact }) => ({
    //           ...contact,
    //         })),
    //       },
    //     };
    //   }, {});

    return {
      dataSheets: {
        companies: {
          headers: GENERATED_HEADERS,
          data: companiesData,
        },
        // ...contactsData,
      },
    };
  }

  async sendEmails(payload: SendEmailsDto, user: User) {
    const {
      object,
      message,
      documents,
      selectedIds,
      contactIds,
      articleIds,
      sendCatalog,
      template,
      ...rest
    } = payload;

    const signatureHtml = this.mailService.generateSignatureHtml(user);

    const { filters, where } = this._generateFilters(rest);

    for (const document of documents) {
      for (const companyId of selectedIds) {
        await this.db.document.create({
          data: {
            name: document.name,
            url: document.url,
            company: { connect: { id: companyId } },
          },
        });
      }
    }

    const data = await this.db.company.findMany({
      where: {
        AND: [
          ...(!!selectedIds.length ? [{ id: { in: selectedIds } }] : []),
          filters,
          ...(!!Object.keys(where).length ? [where] : []),
        ],
      },
      select: {
        id: true,
        email: true,
        companyName: true,
      },
    });

    // Generate PDFs for selected articles
    const articleAttachments: { name: string; url: string }[] = [];

    // Determine which article IDs to use
    let resolvedArticleIds = articleIds?.length ? articleIds : [];

    // If sendCatalog is checked but no articles selected, include all articles
    if (sendCatalog && !resolvedArticleIds.length) {
      const allArticles = await this.db.article.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      resolvedArticleIds = allArticles.map((a) => a.id);
    }

    if (resolvedArticleIds.length) {
      if (sendCatalog) {
        // Generate a single catalog PDF with all selected articles
        const generatedPdf = await this.articleService.generateCataloguePdf({
          articleIds: resolvedArticleIds,
        });

        const uploadedPdf = await this.mediaService.uploadFile(
          generatedPdf,
          `catalogue-articles.pdf`,
          'email-documents',
        );

        articleAttachments.push({
          name: 'Catalogue Articles',
          url: getS3Url(`${uploadedPdf}`),
        });
      } else {
        // Generate individual PDFs per article
        for (const articleId of resolvedArticleIds) {
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
    }

    // Build file attachments for Brevo (actual PDF/image attachments)
    const fileAttachments = [
      ...documents.map(({ name, url }) => ({
        name: name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')
          ? name
          : `${name}.pdf`,
        url: getS3Url(`email-documents/${url}`),
      })),
      ...articleAttachments.map(({ name, url }) => ({
        name: `${name}.pdf`,
        url,
      })),
    ];

    for (const company of data) {
      // If specific contacts were selected, use those; otherwise fallback to company email
      const recipients: { email: string; name: string }[] = [];

      if (contactIds?.length) {
        const selectedContacts = await this.db.contact.findMany({
          where: {
            id: { in: contactIds },
            companyId: company.id,
            email: { not: '' },
          },
          select: { email: true, firstName: true, lastName: true },
        });
        for (const contact of selectedContacts) {
          recipients.push({
            email: contact.email,
            name: `${contact.firstName} ${contact.lastName}`,
          });
        }
      } else if (company.email) {
        recipients.push({
          email: company.email,
          name: company.companyName,
        });
      }

      if (recipients.length === 0) {
        continue;
      }

      for (const recipient of recipients) {
        await this.mailService.send({
          sender: {
            email: 'info@ismomat.fr',
            name: user.name || 'ZEKRI Ismo',
          },
          replyTo: {
            email: 'info@ismomat.fr',
            name: user.name || 'ZEKRI Ismo',
          },
          to: [recipient],
          subject: object,
          htmlContent: `${message}${signatureHtml || user.username === 'najib' ? `<br/><table cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr>${signatureHtml ? `<td style="vertical-align:middle;padding-right:16px;"><img src="${signatureHtml}" style="display:block;max-height:104px;width:auto;" /></td>` : ''}${user.username === 'najib' ? `<td style="vertical-align:middle;"><img src="https://ismo-media.s3.eu-west-3.amazonaws.com/profiles/najib.jpeg" style="display:block;max-height:104px;width:auto;" /></td>` : ''}</tr></table>` : ''}`,
          attachment: fileAttachments.length > 0 ? fileAttachments : undefined,
        });
      }
    }

    return true;
  }

  async sendEmailing(payload: SendEmailingDto, user: User) {
    const { template, companyIds } = payload;

    const signatureHtml = this.mailService.generateSignatureHtml(user);

    for (const companyId of companyIds) {
      const company = await this.db.company.findUnique({
        where: { id: companyId },
        select: { id: true, companyName: true, email: true },
      });
      if (!company) continue;

      // Fetch all contacts with email for this company
      const contacts = await this.db.contact.findMany({
        where: {
          companyId: company.id,
          email: { not: '' },
        },
        select: { email: true, firstName: true, lastName: true },
      });

      // If no contacts with email, fallback to company email
      const recipients = contacts.length > 0
        ? contacts.map((c) => ({ email: c.email, name: `${c.firstName} ${c.lastName}` }))
        : company.email
          ? [{ email: company.email, name: company.companyName }]
          : [];

      for (const recipient of recipients) {
        await this.mailService.send({
          sender: {
            email: 'info@ismomat.fr',
            name: user.name || 'ZEKRI Ismo',
          },
          replyTo: {
            email: 'info@ismomat.fr',
            name: user.name || 'ZEKRI Ismo',
          },
          to: [recipient],
          subject: template,
          ...(user.username === 'dina'
            ? {
                templateId: 4,
                params: { companyName: company.companyName, signature: signatureHtml },
              }
            : {
                htmlContent: `
                  <p>Bonjour,</p>
                  <p>Nous tenons à vous remercier pour votre confiance et votre collaboration.</p>
                  <p>Nous restons à votre disposition pour toute question.</p>
                  <p>Cordialement,</p>
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                    <tr>
                      ${signatureHtml ? `<td style="vertical-align:middle;padding-right:16px;"><img src="${signatureHtml}" style="display:block;max-height:104px;width:auto;" /></td>` : ''}
                      ${user.username === 'najib' ? `<td style="vertical-align:middle;"><img src="https://ismo-media.s3.eu-west-3.amazonaws.com/profiles/najib.jpeg" style="display:block;max-height:104px;width:auto;" /></td>` : ''}
                    </tr>
                  </table>
                `,
              }),
        });
      }
    }

    return true;
  }

  async _generatePDFFirstSection(
    doc: PDFKit.PDFDocument,
    company: Prisma.CompanyGetPayload<{
      include: {
        categories: true;
        contactOrigin: true;
        followedBy: true;
        industries: true;
        sections: true;
        usedItems: true;
        desiredItems: true;
        companyType: true;
        contacts: true;
      };
    }>,
    containerWidth: number,
    contentStartY: number,
    textStartY: number,
  ) {
    // first section
    const firstSectionWidth = containerWidth / 3;
    doc
      .roundedRect(25, contentStartY + 75, firstSectionWidth, 490, 10)
      .fill('#FAFAFA');
    doc
      .fillColor('#1F1F1F')
      .fontSize(12)
      .text('Informations Société', 40, textStartY + 85, {
        width: firstSectionWidth - 20,
      });
    doc
      .moveTo(40, textStartY + 105)
      .lineTo(180, textStartY + 105)
      .strokeColor('#1F1F1F')
      .lineWidth(1)
      .stroke();

    const firstSectionDiffY = 50;

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Adresse société :', 40, textStartY + 125, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(`${company.address}`, 40 + 90, textStartY + 125, {
        width: firstSectionWidth / 2 - 20,
      });

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Téléphone :', 40, textStartY + firstSectionDiffY + 125, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.phoneNumber}`,
        40 + 90,
        textStartY + firstSectionDiffY + 125,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Email :', 40, textStartY + 2 * firstSectionDiffY + 100, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.email}`,
        40 + 90,
        textStartY + 2 * firstSectionDiffY + 100,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Compl :', 40, textStartY + 3 * firstSectionDiffY + 90, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.compl}`,
        40 + 90,
        textStartY + 3 * firstSectionDiffY + 90,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Pays :', 40, textStartY + 4 * firstSectionDiffY + 70, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.country}`,
        40 + 90,
        textStartY + 4 * firstSectionDiffY + 70,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Ville :', 40, textStartY + 5 * firstSectionDiffY + 50, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.city}`,
        40 + 90,
        textStartY + 5 * firstSectionDiffY + 50,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Site Web :', 40, textStartY + 6 * firstSectionDiffY + 30, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.website}`,
        40 + 90,
        textStartY + 6 * firstSectionDiffY + 30,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Code Postal :', 40, textStartY + 7 * firstSectionDiffY + 20, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.zipCode}`,
        40 + 90,
        textStartY + 7 * firstSectionDiffY + 20,
        {
          width: firstSectionWidth / 2 - 20,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Numéro siret :', 40, textStartY + 8 * firstSectionDiffY, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(`${company.siret}`, 40 + 90, textStartY + 8 * firstSectionDiffY, {
        width: firstSectionWidth / 2 - 20,
      });

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Numéro TVA :', 40, textStartY + 9 * firstSectionDiffY - 10, {
        width: firstSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.vatNumber}`,
        40 + 90,
        textStartY + 9 * firstSectionDiffY - 10,
        { width: firstSectionWidth / 2 - 20 },
      );
  }

  async _generatePDFSecondSection(
    doc: PDFKit.PDFDocument,
    company: Prisma.CompanyGetPayload<{
      include: {
        categories: true;
        contactOrigin: true;
        followedBy: true;
        industries: true;
        sections: true;
        usedItems: true;
        desiredItems: true;
        companyType: true;
        contacts: true;
      };
    }>,
    containerWidth: number,
    contentStartY: number,
    textStartY: number,
  ) {
    // Second section
    const secondSectionWidth = (containerWidth / 3) * 2;
    doc
      .roundedRect(220, contentStartY + 75, secondSectionWidth - 20, 250, 10)
      .fill('#FAFAFA');
    doc
      .fillColor('#1F1F1F')
      .fontSize(12)
      .text('Suivi', 235, textStartY + 85, {
        width: secondSectionWidth - 20,
      });
    doc
      .moveTo(235, textStartY + 105)
      .lineTo(530, textStartY + 105)
      .strokeColor('#1F1F1F')
      .lineWidth(1)
      .stroke();

    const secondSectionDiffY = 50;

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Type de Fiche :', 235, textStartY + 125, {
        width: secondSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(`${company.companyType?.name}`, 235 + 115, textStartY + 125, {
        width: secondSectionWidth / 2 - 10,
      });

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Code :', 235, textStartY + secondSectionDiffY + 100, {
        width: secondSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.code}`,
        235 + 115,
        textStartY + secondSectionDiffY + 100,
        {
          width: secondSectionWidth / 2 - 10,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Suivi Par :', 235, textStartY + 2 * secondSectionDiffY + 75, {
        width: secondSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.followedBy ? company.followedBy.name : ''}`,
        235 + 115,
        textStartY + 2 * secondSectionDiffY + 75,
        { width: secondSectionWidth / 2 - 10 },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        '- Article Utilisé :',
        235,
        textStartY + 3 * secondSectionDiffY + 50,
        {
          width: secondSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.usedItems.map(({ name }) => name).join(', ')}`,
        235 + 115,
        textStartY + 3 * secondSectionDiffY + 50,
        { width: secondSectionWidth / 2 - 10 },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        '- Article Désiré :',
        235,
        textStartY + 4 * secondSectionDiffY + 35,
        {
          width: secondSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.desiredItems.map(({ name }) => name).join(', ')}`,
        235 + 115,
        textStartY + 4 * secondSectionDiffY + 35,
        { width: secondSectionWidth / 2 - 10 },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        `- Descriptif de l'activité :`,
        235,
        textStartY + 5 * secondSectionDiffY + 15,
        {
          width: secondSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.activityDescription}`,
        235 + 115,
        textStartY + 5 * secondSectionDiffY + 15,
        { width: secondSectionWidth / 2 - 10 },
      );
  }

  async _generatePDFThirdSection(
    doc: PDFKit.PDFDocument,
    company: Prisma.CompanyGetPayload<{
      include: {
        categories: true;
        contactOrigin: true;
        followedBy: true;
        industries: true;
        sections: true;
        usedItems: true;
        desiredItems: true;
        companyType: true;
        contacts: true;
      };
    }>,
    containerWidth: number,
    contentStartY: number,
    textStartY: number,
  ) {
    // third section
    const thirdSectionWidth = (containerWidth / 3) * 2;

    doc
      .roundedRect(
        220,
        contentStartY + 270 + 75,
        thirdSectionWidth - 20,
        220,
        10,
      )
      .fill('#FAFAFA');
    doc
      .fillColor('#1F1F1F')
      .fontSize(12)
      .text('Relation', 235, textStartY + 270 + 85, {
        width: thirdSectionWidth - 20,
      });
    doc
      .moveTo(235, textStartY + 270 + 105)
      .lineTo(530, textStartY + 270 + 105)
      .strokeColor('#1F1F1F')
      .lineWidth(1)
      .stroke();

    const thirdSectionDiffY = 50;

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text('- Potentiel de la société :', 235, textStartY + 270 + 125, {
        width: thirdSectionWidth / 2,
      });
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${COMPANY_POTENTIAL_OPTIONS[company.companyPotential]}`,
        235 + 120,
        textStartY + 270 + 125,
        {
          width: thirdSectionWidth / 2 - 10,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        '- Origine du contact :',
        235,
        textStartY + 270 + 95 + thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.contactOrigin ? company.contactOrigin.name : ''}`,
        235 + 120,
        textStartY + 270 + 95 + thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2 - 10,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        '- Industrie :',
        235,
        textStartY + 270 + 70 + 2 * thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.industries.map(({ name }) => name).join(', ')}`,
        235 + 120,
        textStartY + 270 + 70 + 2 * thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2 - 10,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        '- Catégorie :',
        235,
        textStartY + 270 + 60 + 3 * thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.categories.map(({ name }) => name).join(', ')}`,
        235 + 120,
        textStartY + 270 + 60 + 3 * thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2 - 10,
        },
      );

    doc
      .fillColor('#898989')
      .fontSize(10)
      .text(
        '- Rubrique :',
        235,
        textStartY + 270 + 50 + 4 * thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2,
        },
      );
    doc
      .fillColor('#1F1F1F')
      .fontSize(10)
      .text(
        `${company.sections.map(({ name }) => name).join(', ')}`,
        235 + 120,
        textStartY + 270 + 50 + 4 * thirdSectionDiffY,
        {
          width: thirdSectionWidth / 2 - 10,
        },
      );
  }

  async _generatePDFContactsTable(
    doc: PDFKit.PDFDocument,
    table: {
      x: number;
      y: number;
      width: number;
      headers: string[];
      rows: string[][];
      rowHeight: number;
      columnWidths: number[];
      margin: number;
    },
  ) {
    // Draw table headers
    let startX = table.x;
    let startY = table.y;
    const radius = 5;

    doc.fillColor('#1F1F1F').fontSize(12).text('Contacts', 25, 50, {
      width: 300,
    });

    doc.fontSize(10);

    // Rounded header background as one block
    doc.roundedRect(startX, startY, table.width, table.rowHeight, 8).fill('#F5F6FA');

    table.headers.forEach((header, index) => {
      doc
        .fillColor('#495057')
        .text(header, startX + table.margin, startY + 15, {
          width: table.columnWidths[index] - 2 * table.margin,
          align: 'center',
        });

      startX += table.columnWidths[index];
    });

    startY += table.rowHeight;

    // Draw table rows
    doc.fontSize(10);

    table.rows.forEach((row, index) => {
      startX = table.x;

      // Calculate the maximum height required for this row
      const noteIndex = 6; // Column index of the "Note" field
      const noteWidth = table.columnWidths[noteIndex] - 2 * table.margin;
      const noteHeight = calculateTextHeight(doc, row[noteIndex], noteWidth);
      const rowHeight = Math.max(35, noteHeight); // Ensure a minimum row height

      row.forEach((cell, index) => {
        const cellX = startX;
        const cellY = startY;
        const cellWidth = table.columnWidths[index];

        doc.rect(cellX, cellY, cellWidth, rowHeight).fill('#FFFFFF');

        if (index === 5)
          doc.image(cell, cellX + table.margin + 15, cellY + 10, {
            width: 14,
            height: 14,
          });
        else
          doc
            .fillColor('#000000')
            .text(cell, cellX + table.margin, cellY + 10, {
              width: cellWidth - 2 * table.margin,
              align: index === noteIndex ? 'left' : 'center',
            });

        startX += cellWidth;
      });

      doc
        .moveTo(table.x, startY)
        .lineTo(table.x + table.width, startY)
        .strokeColor('#9CA3AF')
        .lineWidth(1.5)
        .stroke();

      startY += rowHeight;
    });

    doc
      .moveTo(table.x, startY)
      .lineTo(table.x + table.width, startY)
      .strokeColor('#9CA3AF')
      .lineWidth(1.5)
      .stroke();
  }
  async _generatePDFFinalSection(
    doc: PDFKit.PDFDocument,
    table: {
      x: number;
      y: number;
      width: number;
      headers: string[];
      rows: string[][];
      rowHeight: number;
      columnWidths: number[];
      margin: number;
    },
    memo: string,
  ) {
    // Draw table headers
    let startX = table.x;
    let startY = table.y;
    const radius = 5;

    doc.fillColor('#1F1F1F').fontSize(12).text('Parce du Matériel', 25, 50, {
      width: 300,
    });

    doc.fontSize(10);

    // Rounded header background as one block
    doc.roundedRect(startX, startY, table.width, table.rowHeight, 8).fill('#F5F6FA');

    table.headers.forEach((header, index) => {
      doc
        .fillColor('#495057')
        .text(header, startX + table.margin, startY + 15, {
          width: table.columnWidths[index] - 2 * table.margin,
          align: 'center',
        });

      startX += table.columnWidths[index];
    });

    startY += table.rowHeight;

    // Draw table rows
    doc.fontSize(10);

    table.rows.forEach((row, index) => {
      startX = table.x;

      // Calculate the maximum height required for this row
      const noteIndex = 6; // Column index of the "Note" field
      const noteWidth = table.columnWidths[noteIndex] - 2 * table.margin;
      const noteHeight = calculateTextHeight(doc, row[noteIndex], noteWidth);
      const rowHeight = Math.max(35, noteHeight); // Ensure a minimum row height

      row.forEach((cell, index) => {
        const cellX = startX;
        const cellY = startY;
        const cellWidth = table.columnWidths[index];

        doc.rect(cellX, cellY, cellWidth, rowHeight).fill('#FFFFFF');

        if (index === 5)
          doc.image(cell, cellX + table.margin + 15, cellY + 10, {
            width: 14,
            height: 14,
          });
        else
          doc
            .fillColor('#000000')
            .text(cell, cellX + table.margin, cellY + 10, {
              width: cellWidth - 2 * table.margin,
              align: index === noteIndex ? 'left' : 'center',
            });

        startX += cellWidth;
      });

      doc
        .moveTo(table.x, startY)
        .lineTo(table.x + table.width, startY)
        .strokeColor('#9CA3AF')
        .lineWidth(1.5)
        .stroke();

      startY += rowHeight;
    });

    doc
      .moveTo(table.x, startY)
      .lineTo(table.x + table.width, startY)
      .strokeColor('#9CA3AF')
      .lineWidth(1.5)
      .stroke();

    if (memo) {
      doc.addPage();

      doc.fillColor('#1F1F1F').fontSize(12).text('Memo', 25, 50, {
        width: 300,
      });

      doc.moveDown();
      const pureString = memo.replace(/<[^>]*>/g, '');
      doc.fillColor('#495057').text(pureString, 25, 75, {
        width: 550,
      });
    }
  }

  async generateCompaniesPDF(
    payload: GenerateCompaniesPdfDto,
    response?: Response,
  ) {
    const { companiesIds } = payload;

    // If multiple companies selected, generate list-style PDF
    if (companiesIds.length > 1) {
      return this._generateCompaniesListPDF(companiesIds, response);
    }

    const logoPath = path.join(__dirname, '../images/ismo-logo-full.png');
    const yesLogoPath = path.join(__dirname, '../images/yes.png');
    const noLogoPath = path.join(__dirname, '../images/no.png');

    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

    const pdfChunks: Uint8Array[] = [];
    doc.on('data', (chunk) => pdfChunks.push(chunk));

    const companies = await this.db.company.findMany({
      where: { id: { in: companiesIds } },
      include: {
        categories: true,
        contactOrigin: true,
        followedBy: true,
        industries: true,
        sections: true,
        usedItems: true,
        desiredItems: true,
        companyType: true,
        contacts: true,
        Article: true,
      },
    });

    for (const [index, company] of companies.entries()) {
      // --- PAGE 1: Company Info ---
      const centerX = (doc.page.width - 340) / 2;
      const logoHeight = 80;
      const logoY = 40;
      doc.image(logoPath, centerX, logoY, { width: 340, height: logoHeight });

      const contentStartY = logoY + logoHeight + 20;
      const containerPadding = 5;
      const containerWidth = doc.page.width - 50;
      const containerHeight = 60;
      const textStartY = contentStartY + containerPadding;

      // Company name title box
      doc
        .roundedRect(25, contentStartY, containerWidth, containerHeight, 10)
        .fill('#f5f6fa');
      doc
        .fillColor('#0A2D6E')
        .fontSize(18)
        .text(`${company.companyName}`, 30, textStartY + 18, {
          align: 'center',
          width: containerWidth - 20,
        });

      // Info sections
      await this._generatePDFFirstSection(
        doc,
        company,
        containerWidth,
        contentStartY,
        textStartY,
      );
      await this._generatePDFSecondSection(
        doc,
        company,
        containerWidth,
        contentStartY,
        textStartY,
      );
      await this._generatePDFThirdSection(
        doc,
        company,
        containerWidth,
        contentStartY,
        textStartY,
      );

      // Contacts table (same page, below sections)
      const contactsTableY = contentStartY + 580;
      doc.fillColor('#1F1F1F').fontSize(12).text('Contacts', 25, contactsTableY, { width: 300 });
      doc
        .moveTo(25, contactsTableY + 18)
        .lineTo(100, contactsTableY + 18)
        .strokeColor('#1F1F1F')
        .lineWidth(1)
        .stroke();

      const contactTable = {
        x: 20,
        y: contactsTableY + 25,
        width: 555,
        headers: ['Civilité', 'Nom', 'Prénom', 'Fonctionnalité', 'GSM', 'Whatsapp', 'Note'],
        rows: company.contacts.map((contact) => [
          contact.gender === 'MALE' ? 'Monsieur' : 'Madame',
          contact.lastName,
          contact.firstName,
          contact.functionality,
          contact.phoneNumber,
          contact.hasWhatsapp ? yesLogoPath : noLogoPath,
          contact.note,
        ]),
        rowHeight: 30,
        columnWidths: [65, 60, 60, 100, 100, 70, 100],
        margin: 8,
      };
      let currentY = await this._generatePDFTableInline(doc, contactTable);

      // Parc du Matériel table
      const parcRows = company.Article.map((article) => [
        article.createdAt.toISOString().split('T')[0],
        article.reference,
        article.title,
        String(article.purchasePriceWithoutTVA ?? ''),
        article.equipmentCondition ?? '',
      ]);

      {
        let parcStartY = currentY + 25;
        // Need space for title + header row
        if (parcStartY + 80 > doc.page.height - 50) {
          doc.addPage();
          parcStartY = 50;
        }
        doc.fillColor('#1F1F1F').fontSize(12).text('Parc du Matériel', 25, parcStartY, { width: 300 });
        doc
          .moveTo(25, parcStartY + 18)
          .lineTo(140, parcStartY + 18)
          .strokeColor('#1F1F1F')
          .lineWidth(1)
          .stroke();

        const parcTable = {
          x: 20,
          y: parcStartY + 25,
          width: 550,
          headers: ['Date de création', 'Référence', 'Titre', "Prix d'achat (HT)", 'Etat'],
          rows: parcRows,
          rowHeight: 30,
          columnWidths: [110, 110, 110, 110, 110],
          margin: 8,
        };
        currentY = await this._generatePDFTableInline(doc, parcTable);
      }

      // Fetch offers from Zoho before deciding whether to add more content
      let allOffers: any[] = [];

      if (company.zohoContactId) {
        try {
          const result = await this.zohoService.getCompanyOffers(company.zohoContactId);
          allOffers = result.data;
        } catch {
          // Zoho not available
        }
      }

      const offerRows: string[][] = allOffers.map((offer: any) => [
        offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('fr-FR') : '',
        offer.number || '',
        offer.title || '-',
        offer.product_name || '-',
        offer.status || '',
        offer.total_amount != null ? `${offer.total_amount}` : '0',
        offer.type || '',
      ]);

      // Offres section - always show
      {
        let offresStartY = currentY + 25;
        if (offresStartY + 80 > doc.page.height - 50) {
          doc.addPage();
          offresStartY = 50;
        }
        doc.fillColor('#1F1F1F').fontSize(12).text('Offres', 25, offresStartY, { width: 300 });
        doc
          .moveTo(25, offresStartY + 18)
          .lineTo(80, offresStartY + 18)
          .strokeColor('#1F1F1F')
          .lineWidth(1)
          .stroke();

        const offerTable = {
          x: 20,
          y: offresStartY + 25,
          width: 555,
          headers: ['Emis Le', 'Numéro', 'Emis Par', 'Article', 'Statut', 'Prix', 'Désignation'],
          rows: offerRows,
          rowHeight: 30,
          columnWidths: [75, 80, 70, 75, 75, 65, 115],
          margin: 4,
        };
        currentY = await this._generatePDFTableInline(doc, offerTable);
      }

      // Memo section - always show
      {
        let memoStartY = currentY + 20;
        if (memoStartY + 60 > doc.page.height - 50) {
          doc.addPage();
          memoStartY = 50;
        }
        doc.fillColor('#1F1F1F').fontSize(12).text('Memo', 25, memoStartY, { width: 300 });
        doc
          .moveTo(25, memoStartY + 18)
          .lineTo(80, memoStartY + 18)
          .strokeColor('#1F1F1F')
          .lineWidth(1)
          .stroke();

        if (company.memo) {
          const pureString = company.memo.replace(/<[^>]*>/g, '');
          doc.fillColor('#495057').fontSize(10).text(pureString, 25, memoStartY + 30, {
            width: 550,
          });
        }
      }

      if (index !== companies.length - 1) doc.addPage();
    }

    // All pages have content in company sheets (multi-page per company possible)
    const range = doc.bufferedPageRange();
    const allPageIndices: number[] = [];
    for (let i = range.start; i < range.start + range.count; i++) allPageIndices.push(i);
    addPagination(doc, new Set(allPageIndices));

    return new Promise<void>((resolve) => {
      doc.on('end', async () => {
        const rawBuffer = Buffer.concat(pdfChunks);
        // No page stripping needed — all pages are content pages
        const cleaned = rawBuffer;
        if (response) {
          response.setHeader('Content-Length', cleaned.length);
          response.end(cleaned);
        }
        resolve();
      });
      doc.end();
    });
  }

  private async _generatePDFTableInline(
    doc: PDFKit.PDFDocument,
    table: {
      x: number;
      y: number;
      width: number;
      headers: string[];
      rows: string[][];
      rowHeight: number;
      columnWidths: number[];
      margin: number;
    },
  ): Promise<number> {
    let startX = table.x;
    let startY = table.y;

    // Header row
    const tableStartY = startY;
    doc.fontSize(8);
    // Draw rounded header background as one block
    doc.roundedRect(table.x, startY, table.width, table.rowHeight, 8).fill('#F5F6FA');
    table.headers.forEach((header, i) => {
      doc
        .fillColor('#495057')
        .text(header, startX + table.margin, startY + 10, {
          width: table.columnWidths[i] - 2 * table.margin,
          align: 'center',
        });
      startX += table.columnWidths[i];
    });

    // Header bottom border
    doc
      .moveTo(table.x, startY + table.rowHeight)
      .lineTo(table.x + table.width, startY + table.rowHeight)
      .strokeColor('#9CA3AF')
      .lineWidth(1.5)
      .stroke();

    startY += table.rowHeight;
    doc.fontSize(8);

    // Data rows
    for (const row of table.rows) {
      startX = table.x;

      // Page break check
      if (startY + table.rowHeight > doc.page.height - 50) {
        doc.addPage();
        startY = 50;
      }

      for (let i = 0; i < row.length; i++) {
        const cellX = startX;
        const cellWidth = table.columnWidths[i];

        doc.rect(cellX, startY, cellWidth, table.rowHeight).fill('#FFFFFF');

        // Check if cell is an image path (for whatsapp yes/no icons)
        if (row[i] && (row[i].endsWith('.png') || row[i].endsWith('.jpg'))) {
          try {
            doc.image(row[i], cellX + table.margin + 10, startY + 8, {
              width: 12,
              height: 12,
            });
          } catch {
            doc.fillColor('#000').text(row[i], cellX + table.margin, startY + 10, {
              width: cellWidth - 2 * table.margin,
              align: 'center',
            });
          }
        } else {
          doc
            .fillColor('#000000')
            .text(row[i] ?? '', cellX + table.margin, startY + 10, {
              width: cellWidth - 2 * table.margin,
              align: 'center',
            });
        }

        startX += cellWidth;
      }

      // Row separator line
      doc
        .moveTo(table.x, startY + table.rowHeight)
        .lineTo(table.x + table.width, startY + table.rowHeight)
        .strokeColor('#9CA3AF')
        .lineWidth(1.5)
        .stroke();

      startY += table.rowHeight;
    }


    return startY;
  }

  private async _generateCompaniesListPDF(
    companiesIds: number[],
    response?: Response,
  ) {
    const logoPath = path.join(__dirname, '../images/ismo-logo-full.png');
    const regularFont = path.join(__dirname, '../assets/Roboto-Regular.ttf');
    const boldFont = path.join(__dirname, '../assets/Roboto-Bold.ttf');

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
    });

    const pdfChunks: Uint8Array[] = [];
    doc.on('data', (chunk) => pdfChunks.push(chunk));

    doc.registerFont('Regular', regularFont);
    doc.registerFont('Bold', boldFont);

    const companies = await this.db.company.findMany({
      where: { id: { in: companiesIds } },
      include: {
        sections: true,
        contacts: true,
        actions: {
          include: { actionType: true },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });

    const today = new Date().toLocaleDateString('fr-FR');

    // Potential colors for PDF (bg, text)
    const potentialColors: Record<string, { bg: string; text: string }> = {
      AVAILABLE_EQUIPMENT: { bg: '#FFF280', text: '#747400' },
      NEUTRAL: { bg: '#E0E0E0', text: '#616161' },
      MATERIAL_REQUEST: { bg: '#A2D5FF', text: '#1565C0' },
      PROJECT_STUDY: { bg: '#A0EAA3', text: '#2E7D32' },
      NEGOTIATION: { bg: '#FCEDBF', text: '#FF8A00' },
      CONCLUSION: { bg: '#FFA7B0', text: '#C62828' },
    };

    // --- HEADER ---
    const pageWidth = doc.page.width;
    const margin = 30;

    // Logo
    doc.image(logoPath, (pageWidth - 200) / 2, 20, { width: 200 });

    // Date top-right
    doc.font('Regular').fontSize(10).fillColor('#333');
    doc.text(today, pageWidth - margin - 80, 30, { width: 80, align: 'right' });

    // Title
    const titleY = 80;
    const titleWidth = 250;
    const titleX = (pageWidth - titleWidth) / 2;
    doc
      .save()
      .dash(4, { space: 3 })
      .roundedRect(titleX, titleY, titleWidth, 35, 5)
      .strokeColor('#0A2D6E')
      .stroke()
      .restore();
    doc
      .font('Bold')
      .fontSize(16)
      .fillColor('#0A2D6E')
      .text('LISTE DES SOCIÉTÉS', titleX, titleY + 10, {
        width: titleWidth,
        align: 'center',
      });

    // --- TABLE ---
    const tableTop = titleY + 55;
    const colWidths = [109, 117, 95, 124, 110, 110, 116];
    const tableX = margin;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const headers = [
      'Société',
      'Potentiel',
      'Rubrique',
      'Téléphone #\nContact',
      'Dernière\naction',
      'Dernier appel\nde prospection',
      'Commentaire',
    ];

    // Header row
    const headerHeight = 35;
    doc
      .rect(tableX, tableTop, tableWidth, headerHeight)
      .fill('#F5F6FA');

    let hx = tableX;
    doc.font('Bold').fontSize(7).fillColor('#333');
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], hx + 4, tableTop + 6, {
        width: colWidths[i] - 8,
        align: 'center',
      });
      hx += colWidths[i];
    }

    // Draw header bottom border
    doc
      .moveTo(tableX, tableTop + headerHeight)
      .lineTo(tableX + tableWidth, tableTop + headerHeight)
      .strokeColor('#9CA3AF')
      .lineWidth(1.5)
      .stroke();

    let currentY = tableTop + headerHeight;
    let currentPageIdx = 0;
    const contentPages = new Set<number>([0]);

    for (const company of companies) {
      const potentialLabel =
        COMPANY_POTENTIAL_OPTIONS[company.companyPotential] || '';
      const potentialStyle = potentialColors[company.companyPotential] || {
        bg: '#E0E0E0',
        text: '#616161',
      };
      const sections = company.sections.map((s) => s.name).join(', ');
      const firstContact = company.contacts[0];
      const contactName = firstContact
        ? `${firstContact.firstName} ${firstContact.lastName}`
        : '';
      const contactPhone = firstContact?.phoneNumber || '';
      const lastAction = company.actions[0];
      const lastActionDesc = lastAction?.object || '';
      const lastActionDate = lastAction
        ? new Date(lastAction.startDate).toLocaleDateString('fr-FR')
        : '';

      // Estimate row height
      const rowHeight = 70;

      // Check page break
      if (currentY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        currentPageIdx++;
        currentY = 30;
      }
      contentPages.add(currentPageIdx);

      // Alternating row background
      doc
        .rect(tableX, currentY, tableWidth, rowHeight)
        .fill('#FFFFFF');

      // Row separator
      doc
        .moveTo(tableX, currentY + rowHeight)
        .lineTo(tableX + tableWidth, currentY + rowHeight)
        .strokeColor('#9CA3AF')
        .lineWidth(1.5)
        .stroke();

      let cx = tableX;
      const cellPadding = 4;
      const cellY = currentY + 8;

      // Col 0: Société
      doc
        .font('Bold')
        .fontSize(8)
        .fillColor('#333')
        .text(company.companyName, cx + cellPadding, cellY, {
          width: colWidths[0] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[0];

      // Col 1: Potentiel (colored badge)
      if (potentialLabel) {
        const badgeWidth = colWidths[1] - 16;
        const badgeX = cx + 8;
        const badgeY = cellY + 5;
        doc
          .save()
          .roundedRect(badgeX, badgeY, badgeWidth, 20, 10)
          .fill(potentialStyle.bg);
        doc
          .font('Regular')
          .fontSize(6.5)
          .fillColor(potentialStyle.text)
          .text(potentialLabel, badgeX, badgeY + 6, {
            width: badgeWidth,
            align: 'center',
          });
        doc.restore();
      }
      cx += colWidths[1];

      // Col 2: Rubrique
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text(sections, cx + cellPadding, cellY, {
          width: colWidths[2] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[2];

      // Col 3: Téléphone # / Contact
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text(contactPhone, cx + cellPadding, cellY, {
          width: colWidths[3] - cellPadding * 2,
          align: 'center',
        });
      doc
        .font('Bold')
        .fontSize(7)
        .text(contactName, cx + cellPadding, cellY + 15, {
          width: colWidths[3] - cellPadding * 2,
          align: 'center',
        });
      // Second phone line
      if (contactPhone) {
        doc
          .font('Regular')
          .fontSize(7)
          .text(contactPhone, cx + cellPadding, cellY + 30, {
            width: colWidths[3] - cellPadding * 2,
            align: 'center',
          });
      }
      cx += colWidths[3];

      // Col 4: Dernière action
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text(lastActionDesc, cx + cellPadding, cellY, {
          width: colWidths[4] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[4];

      // Col 5: Dernier appel de prospection
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text(lastActionDate, cx + cellPadding, cellY, {
          width: colWidths[5] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[5];

      // Col 6: Commentaire (empty for now, would need a field)
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text('', cx + cellPadding, cellY, {
          width: colWidths[6] - cellPadding * 2,
          align: 'center',
        });

      currentY += rowHeight;
    }


    // Page numbers - only on content pages
    const totalContentPages = contentPages.size;
    let pageNum = 0;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      if (contentPages.has(i)) {
        pageNum++;
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc
          .font('Regular')
          .fontSize(9)
          .fillColor('#333')
          .text(
            `${pageNum}/${totalContentPages}`,
            pageWidth - margin - 40,
            doc.page.height - 20,
            { width: 40, align: 'right', lineBreak: false },
          );
      }
    }

    const contentPageIndices = [...contentPages];
    return new Promise<void>((resolve) => {
      doc.on('end', async () => {
        const rawBuffer = Buffer.concat(pdfChunks);
        const cleaned = await keepOnlyPages(rawBuffer, contentPageIndices);
        if (response) {
          response.setHeader('Content-Length', cleaned.length);
          response.end(cleaned);
        }
        resolve();
      });
      doc.end();
    });
  }

  async generateCompaniesReportPDF(
    payload: GetAllCompaniesReportExcelDto,
    response?: Response,
  ) {
    const logoPath = path.join(__dirname, '../images/ismo-logo-full.png');
    const regularFont = path.join(__dirname, '../assets/Roboto-Regular.ttf');
    const boldFont = path.join(__dirname, '../assets/Roboto-Bold.ttf');

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
    });

    const pdfChunks: Uint8Array[] = [];
    doc.on('data', (chunk) => pdfChunks.push(chunk));

    doc.registerFont('Regular', regularFont);
    doc.registerFont('Bold', boldFont);

    const { data, otherOrderBy } =
      await this._generateCompaniesForReport(payload);

    const {
      industries,
      categories,
      sections,
      daysSpentInAvailableEquipment,
      daysSpentInConclusion,
      daysSpentInMaterialRequest,
      daysSpentInNegotiation,
      daysSpentInNeutral,
      daysSpentInProjectStudy,
    } = otherOrderBy;

    const companies = transformObject(data, companyReportExcelTransformer);

    const sort = (key: string) => {
      const order = otherOrderBy[key].name === 'asc' ? 'asc' : 'desc';
      companies.sort((a, b) =>
        a[key] > b[key] ? 1 : b[key] > a[key] ? -1 : 0,
      );
      if (order === 'desc') companies.reverse();
    };

    if (industries) sort('industries');
    if (categories) sort('categories');
    if (sections) sort('sections');
    if (daysSpentInAvailableEquipment) sort('daysSpentInAvailableEquipment');
    if (daysSpentInConclusion) sort('daysSpentInConclusion');
    if (daysSpentInMaterialRequest) sort('daysSpentInMaterialRequest');
    if (daysSpentInNegotiation) sort('daysSpentInNegotiation');
    if (daysSpentInNeutral) sort('daysSpentInNeutral');
    if (daysSpentInProjectStudy) sort('daysSpentInProjectStudy');

    const pageWidth = doc.page.width;
    const margin = 30;
    const today = new Date().toLocaleDateString('fr-FR');

    // Header
    doc.image(logoPath, (pageWidth - 200) / 2, 20, { width: 200 });
    doc.font('Regular').fontSize(10).fillColor('#333');
    doc.text(today, pageWidth - margin - 80, 30, { width: 80, align: 'right' });

    // Title
    const titleY = 80;
    const titleWidth = 300;
    const titleX = (pageWidth - titleWidth) / 2;
    doc
      .save()
      .dash(4, { space: 3 })
      .roundedRect(titleX, titleY, titleWidth, 35, 5)
      .strokeColor('#0A2D6E')
      .stroke()
      .restore();
    doc
      .font('Bold')
      .fontSize(16)
      .fillColor('#0A2D6E')
      .text('RÉCAPITULATIF DES SOCIÉTÉS', titleX, titleY + 10, {
        width: titleWidth,
        align: 'center',
      });

    // Table
    const tableTop = titleY + 55;
    const colWidths = [105, 75, 68, 68, 85, 60, 60, 60, 60, 60, 60];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableX = (pageWidth - tableWidth) / 2;
    const headers = [
      'Société',
      'Industrie',
      'Catégorie',
      'Rubrique',
      'Potentiel Actuel',
      'Dispose\nmatériel (j)',
      'Étude du\nprojet (j)',
      'Négociation\n(j)',
      'Conclusion\n(j)',
      'Neutre/\nAucun (j)',
      'Demande\nmatériel (j)',
    ];

    const potentialColors: Record<string, { bg: string; text: string }> = {
      'Dispose matériel': { bg: '#FFF280', text: '#747400' },
      '0. Neutre/Aucun': { bg: '#E0E0E0', text: '#616161' },
      '1. Demande du matériel': { bg: '#A2D5FF', text: '#1565C0' },
      '2. Etude du projet': { bg: '#A0EAA3', text: '#2E7D32' },
      '3. Négociation': { bg: '#FCEDBF', text: '#FF8A00' },
      '4. Conclusion': { bg: '#FFA7B0', text: '#C62828' },
    };

    // Header row
    const headerHeight = 35;
    doc.roundedRect(tableX, tableTop, tableWidth, headerHeight, 8).fill('#F5F6FA');

    let hx = tableX;
    doc.font('Bold').fontSize(7).fillColor('#333');
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], hx + 4, tableTop + 6, {
        width: colWidths[i] - 8,
        align: 'center',
      });
      hx += colWidths[i];
    }

    // Header bottom border
    doc
      .moveTo(tableX, tableTop + headerHeight)
      .lineTo(tableX + tableWidth, tableTop + headerHeight)
      .strokeColor('#9CA3AF')
      .lineWidth(1.5)
      .stroke();

    let currentY = tableTop + headerHeight;
    const rowHeight = 35;
    let currentPageIdx = 0;
    const contentPages = new Set<number>([0]);

    for (const company of companies) {
      if (currentY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        currentPageIdx++;
        currentY = 30;
      }
      contentPages.add(currentPageIdx);

      doc.rect(tableX, currentY, tableWidth, rowHeight).fill('#FFFFFF');

      // Row bottom border
      doc
        .moveTo(tableX, currentY + rowHeight)
        .lineTo(tableX + tableWidth, currentY + rowHeight)
        .strokeColor('#9CA3AF')
        .lineWidth(1.5)
        .stroke();

      let cx = tableX;
      const cellPadding = 4;
      const cellY = currentY + 8;

      // Société
      doc
        .font('Bold')
        .fontSize(7)
        .fillColor('#333')
        .text(company.name || '', cx + cellPadding, cellY, {
          width: colWidths[0] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[0];

      // Industrie
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text(company.industry || '', cx + cellPadding, cellY, {
          width: colWidths[1] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[1];

      // Catégorie
      doc.text(company.category || '', cx + cellPadding, cellY, {
        width: colWidths[2] - cellPadding * 2,
        align: 'center',
      });
      cx += colWidths[2];

      // Rubrique
      doc.text(company.section || '', cx + cellPadding, cellY, {
        width: colWidths[3] - cellPadding * 2,
        align: 'center',
      });
      cx += colWidths[3];

      // Potentiel Actuel (colored badge)
      const potentialLabel = company.companyPotential || '';
      const potentialStyle = potentialColors[potentialLabel] || {
        bg: '#E0E0E0',
        text: '#616161',
      };
      if (potentialLabel) {
        const badgeWidth = colWidths[4] - 10;
        const badgeX = cx + 5;
        const badgeY = cellY + 2;
        doc
          .save()
          .roundedRect(badgeX, badgeY, badgeWidth, 18, 9)
          .fill(potentialStyle.bg);
        doc
          .font('Regular')
          .fontSize(6)
          .fillColor(potentialStyle.text)
          .text(potentialLabel, badgeX, badgeY + 5, {
            width: badgeWidth,
            align: 'center',
          });
        doc.restore();
      }
      cx += colWidths[4];

      // Days columns
      const daysFields = [
        company.daysSpentInAvailableEquipment,
        company.daysSpentInProjectStudy,
        company.daysSpentInNegotiation,
        company.daysSpentInConclusion,
        company.daysSpentInNeutral,
        company.daysSpentInMaterialRequest,
      ];

      for (let d = 0; d < daysFields.length; d++) {
        doc
          .font('Regular')
          .fontSize(8)
          .fillColor('#333')
          .text(daysFields[d] || '0', cx + cellPadding, cellY, {
            width: colWidths[5 + d] - cellPadding * 2,
            align: 'center',
          });
        cx += colWidths[5 + d];
      }

      currentY += rowHeight;
    }


    // Page numbers - only on content pages
    const totalContentPages = contentPages.size;
    let pageNum = 0;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      if (contentPages.has(i)) {
        pageNum++;
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc
          .font('Regular')
          .fontSize(9)
          .fillColor('#333')
          .text(
            `${pageNum}/${totalContentPages}`,
            pageWidth - margin - 40,
            doc.page.height - 20,
            { width: 40, align: 'right', lineBreak: false },
          );
      }
    }

    const contentPageIndices = [...contentPages];
    return new Promise<void>((resolve) => {
      doc.on('end', async () => {
        const rawBuffer = Buffer.concat(pdfChunks);
        const cleaned = await keepOnlyPages(rawBuffer, contentPageIndices);
        if (response) {
          response.setHeader('Content-Length', cleaned.length);
          response.end(cleaned);
        }
        resolve();
      });
      doc.end();
    });
  }

  async generateActionsReportPDF(
    payload: GetAllCompaniesReportExcelDto,
    response?: Response,
  ) {
    const logoPath = path.join(__dirname, '../images/ismo-logo-full.png');
    const regularFont = path.join(__dirname, '../assets/Roboto-Regular.ttf');
    const boldFont = path.join(__dirname, '../assets/Roboto-Bold.ttf');
    const yesLogoPath = path.join(__dirname, '../images/yes.png');
    const noLogoPath = path.join(__dirname, '../images/no.png');

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
    });

    const pdfChunks: Uint8Array[] = [];
    doc.on('data', (chunk) => pdfChunks.push(chunk));

    doc.registerFont('Regular', regularFont);
    doc.registerFont('Bold', boldFont);

    const data = await this.getAllCompaniesActionsReport(payload);
    const actions = data.data.map((action) => ({
      ...action,
      startDate: formatDate(action.startDate, 'dd/MM/yyyy'),
      endDate: formatDate(action.endDate, 'dd/MM/yyyy'),
    }));

    const pageWidth = doc.page.width;
    const margin = 30;
    const today = new Date().toLocaleDateString('fr-FR');

    // Header
    doc.image(logoPath, (pageWidth - 200) / 2, 20, { width: 200 });
    doc.font('Regular').fontSize(10).fillColor('#333');
    doc.text(today, pageWidth - margin - 80, 30, { width: 80, align: 'right' });

    // Title
    const titleY = 80;
    const titleWidth = 250;
    const titleX = (pageWidth - titleWidth) / 2;
    doc
      .save()
      .dash(4, { space: 3 })
      .roundedRect(titleX, titleY, titleWidth, 35, 5)
      .strokeColor('#0A2D6E')
      .stroke()
      .restore();
    doc
      .font('Bold')
      .fontSize(16)
      .fillColor('#0A2D6E')
      .text('LISTE DES ACTIONS', titleX, titleY + 10, {
        width: titleWidth,
        align: 'center',
      });

    // Table
    const tableTop = titleY + 55;
    const colWidths = [117, 110, 102, 102, 102, 110, 58, 80];
    const tableX = margin;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const headers = [
      'Société',
      "Type d'action",
      'Fait par',
      'Date de début',
      'Date de fin',
      'Objet',
      'Fait',
      'Commentaire',
    ];

    // Header row
    const headerHeight = 35;
    doc.roundedRect(tableX, tableTop, tableWidth, headerHeight, 8).fill('#F5F6FA');

    let hx = tableX;
    doc.font('Bold').fontSize(7).fillColor('#333');
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], hx + 4, tableTop + 12, {
        width: colWidths[i] - 8,
        align: 'center',
      });
      hx += colWidths[i];
    }

    doc
      .moveTo(tableX, tableTop + headerHeight)
      .lineTo(tableX + tableWidth, tableTop + headerHeight)
      .strokeColor('#9CA3AF')
      .lineWidth(1.5)
      .stroke();

    let currentY = tableTop + headerHeight;
    const rowHeight = 55;
    let currentPageIdx = 0;
    const contentPages = new Set<number>([0]);

    for (const action of actions) {
      if (currentY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        currentPageIdx++;
        currentY = 30;
      }
      contentPages.add(currentPageIdx);

      doc.rect(tableX, currentY, tableWidth, rowHeight).fill('#FFFFFF');
      doc
        .moveTo(tableX, currentY + rowHeight)
        .lineTo(tableX + tableWidth, currentY + rowHeight)
        .strokeColor('#9CA3AF')
        .lineWidth(1.5)
        .stroke();

      let cx = tableX;
      const cellPadding = 4;
      const cellY = currentY + 8;

      // Société
      doc
        .font('Bold')
        .fontSize(7)
        .fillColor('#333')
        .text(action.companyName || '', cx + cellPadding, cellY, {
          width: colWidths[0] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[0];

      // Type d'action
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor('#333')
        .text(action.actionType || '', cx + cellPadding, cellY, {
          width: colWidths[1] - cellPadding * 2,
          align: 'center',
        });
      cx += colWidths[1];

      // Fait par
      doc.text(action.addedBy || '', cx + cellPadding, cellY, {
        width: colWidths[2] - cellPadding * 2,
        align: 'center',
      });
      cx += colWidths[2];

      // Date de début
      doc.text(action.startDate || '', cx + cellPadding, cellY, {
        width: colWidths[3] - cellPadding * 2,
        align: 'center',
      });
      cx += colWidths[3];

      // Date de fin
      doc.text(action.endDate || '', cx + cellPadding, cellY, {
        width: colWidths[4] - cellPadding * 2,
        align: 'center',
      });
      cx += colWidths[4];

      // Objet
      doc.text(action.object || '', cx + cellPadding, cellY, {
        width: colWidths[5] - cellPadding * 2,
        align: 'center',
      });
      cx += colWidths[5];

      // Fait (icon)
      const iconPath = action.isDone ? yesLogoPath : noLogoPath;
      try {
        doc.image(iconPath, cx + colWidths[6] / 2 - 8, cellY + 4, {
          width: 16,
          height: 16,
        });
      } catch {
        doc.text(action.isDone ? 'Oui' : 'Non', cx + cellPadding, cellY, {
          width: colWidths[6] - cellPadding * 2,
          align: 'center',
        });
      }
      cx += colWidths[6];

      // Commentaire (empty)
      cx += colWidths[7];

      currentY += rowHeight;
    }


    // Page numbers - only on content pages
    const totalContentPages = contentPages.size;
    let pageNum = 0;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      if (contentPages.has(i)) {
        pageNum++;
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc
          .font('Regular')
          .fontSize(9)
          .fillColor('#333')
          .text(
            `${pageNum}/${totalContentPages}`,
            pageWidth - margin - 40,
            doc.page.height - 20,
            { width: 40, align: 'right', lineBreak: false },
          );
      }
    }

    const contentPageIndices = [...contentPages];
    return new Promise<void>((resolve) => {
      doc.on('end', async () => {
        const rawBuffer = Buffer.concat(pdfChunks);
        const cleaned = await keepOnlyPages(rawBuffer, contentPageIndices);
        if (response) {
          response.setHeader('Content-Length', cleaned.length);
          response.end(cleaned);
        }
        resolve();
      });
      doc.end();
    });
  }

  async getCityOptions(country: CountryType, value: string) {
    const cities = COUNTRIES_AND_CITIES[country];
    if (!cities) return [];
    return !value?.length
      ? cities.slice(0, 50).map((city) => ({ value: city, label: city }))
      : cities
          .filter((city) =>
            slugify(city.toLowerCase()).startsWith(
              slugify(value.toLowerCase()),
            ),
          )
          .map((city) => ({ value: city, label: city }));
  }
}
