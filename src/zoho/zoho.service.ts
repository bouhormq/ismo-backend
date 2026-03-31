import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { DatabaseService } from 'src/database/database.service';
import { transformObject } from 'src/utils/functions/misc.functions';
import { ZohoConfig } from './config/zoho.config';
import {
  zohoEstimateTableTransformer,
  zohoInvoiceTableTransformer,
} from './entities/zohoResponse.entity';
import { CompanyIncludeType } from 'src/axonaut/utils/mapping';
import {
  ZohoContactCreateRequest,
  ZohoContactPersonRequest,
  ZohoContactPersonResponse,
  ZohoContactResponse,
  ZohoContactsListResponse,
  ZohoEmailHistoryResponse,
  ZohoEmailRequest,
  ZohoEstimate,
  ZohoInvoice,
  ZohoListResponse,
  ZohoTokenResponse,
} from './type/zoho.type';

@Injectable()
export class ZohoService {
  private readonly logger = new Logger(ZohoService.name);
  private axios: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private prisma: DatabaseService,
    private readonly zohoConfig: ZohoConfig,
  ) {
    this.axios = axios.create({
      baseURL: this.zohoConfig.baseUrl,
    });

    this.axios.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.Authorization = `Zoho-oauthtoken ${token}`;
      config.params = {
        ...config.params,
        organization_id: this.zohoConfig.organizationId,
      };
      return config;
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const { data } = await axios.post<ZohoTokenResponse>(
        `${this.zohoConfig.accountsUrl}/oauth/v2/token`,
        null,
        {
          params: {
            refresh_token: this.zohoConfig.refreshToken,
            client_id: this.zohoConfig.clientId,
            client_secret: this.zohoConfig.clientSecret,
            grant_type: 'refresh_token',
          },
        },
      );

      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to refresh Zoho access token', error?.response?.data);
      throw error;
    }
  }

  public async updateOrRegisterContact(company: CompanyIncludeType) {
    if (!this.zohoConfig.refreshToken) return;

    try {
      if (company.zohoContactId) {
        return this.updateContact(company);
      } else {
        return this.registerContact(company);
      }
    } catch (error) {
      this.logger.error('Error in Zoho updateOrRegisterContact:', error?.response?.data);
    }
  }

  private mapCompanyToZohoContact(company: CompanyIncludeType): ZohoContactCreateRequest {
    const contactPersons = (company.contacts ?? [])
      .filter((c) => c.firstName || c.email)
      .map((c) => ({
        first_name: c.firstName || undefined,
        last_name: c.lastName || undefined,
        email: c.email || undefined,
        phone: c.phoneNumber || undefined,
        designation: c.functionality || undefined,
      }));

    return {
      contact_name: company.companyName || `Company ${company.id}`,
      company_name: company.companyName || '',
      email: company.email || undefined,
      phone: company.phoneNumber || undefined,
      billing_address: {
        address: company.address || undefined,
        city: company.city || undefined,
        zip: company.zipCode || undefined,
        country: company.country || undefined,
      },
      contact_type: 'customer',
      ...(contactPersons.length > 0 && { contact_persons: contactPersons }),
    };
  }

  private async registerContact(company: CompanyIncludeType) {
    // First, try to find an existing contact by company name
    try {
      const { data: searchResult } = await this.axios.get<ZohoContactsListResponse>(
        '/contacts',
        { params: { contact_name: company.companyName } },
      );

      const existingContact = searchResult.contacts?.find(
        (c) => c.contact_name === company.companyName,
      );

      if (existingContact) {
        await this.prisma.company.update({
          where: { id: company.id },
          data: { zohoContactId: existingContact.contact_id },
        });
        return existingContact;
      }
    } catch (error) {
      this.logger.error('Error searching Zoho contacts:', error?.response?.data);
    }

    // Not found — create a new contact
    try {
      const body = this.mapCompanyToZohoContact(company);
      const { data } = await this.axios.post<ZohoContactResponse>(
        '/contacts',
        body,
      );

      await this.prisma.company.update({
        where: { id: company.id },
        data: { zohoContactId: data.contact.contact_id },
      });

      return data.contact;
    } catch (error) {
      this.logger.error('Error creating Zoho contact:', error?.response?.data);
    }
  }

  private async updateContact(company: CompanyIncludeType) {
    try {
      const body = this.mapCompanyToZohoContact(company);
      await this.axios.put(`/contacts/${company.zohoContactId}`, body);
    } catch (error) {
      if (error?.response?.status === 404) {
        this.logger.warn(`Zoho contact ${company.zohoContactId} not found, recreating...`);
        await this.prisma.company.update({
          where: { id: company.id },
          data: { zohoContactId: null },
        });
        return this.registerContact({ ...company, zohoContactId: null });
      }
      this.logger.error('Error updating Zoho contact:', error?.response?.data);
    }
  }

  public async getCompanyOffers(zohoContactId: string) {
    let invoicesRaw: ZohoInvoice[] = [];
    let estimatesRaw: ZohoEstimate[] = [];

    try {
      const { data } = await this.axios.get<ZohoListResponse<ZohoInvoice>>(
        '/invoices',
        { params: { customer_id: zohoContactId } },
      );
      invoicesRaw = data.invoices || [];
    } catch (error) {
      this.logger.error('Error fetching Zoho invoices:', error?.response?.data);
    }

    try {
      const { data } = await this.axios.get<ZohoListResponse<ZohoEstimate>>(
        '/estimates',
        { params: { customer_id: zohoContactId } },
      );
      estimatesRaw = data.estimates || [];
    } catch (error) {
      this.logger.error('Error fetching Zoho estimates:', error?.response?.data);
    }

    const invoices = transformObject(invoicesRaw, zohoInvoiceTableTransformer);
    const estimates = transformObject(estimatesRaw, zohoEstimateTableTransformer);

    const allData = [...estimates, ...invoices];
    return {
      data: allData,
      count: allData.length,
    };
  }

  public async getInvoicePdfUrl(invoiceId: string): Promise<string | null> {
    try {
      const { data } = await this.axios.get(
        `/invoices/${invoiceId}`,
        { params: { accept: 'json' } },
      );
      return data.invoice?.invoice_url || null;
    } catch (error) {
      this.logger.error('Error fetching Zoho invoice PDF:', error?.response?.data);
      return null;
    }
  }

  public async emailInvoice(invoiceId: string, emailRequest: ZohoEmailRequest) {
    try {
      const { data } = await this.axios.post(
        `/invoices/${invoiceId}/email`,
        emailRequest,
      );
      return data;
    } catch (error) {
      this.logger.error('Error emailing Zoho invoice:', error?.response?.data);
      throw error;
    }
  }

  public async emailEstimate(estimateId: string, emailRequest: ZohoEmailRequest) {
    try {
      const { data } = await this.axios.post(
        `/estimates/${estimateId}/email`,
        emailRequest,
      );
      return data;
    } catch (error) {
      this.logger.error('Error emailing Zoho estimate:', error?.response?.data);
      throw error;
    }
  }

  public async getInvoiceEmails(invoiceId: string) {
    try {
      const { data } = await this.axios.get<ZohoEmailHistoryResponse>(
        `/invoices/${invoiceId}/emails`,
      );
      return (data.email_history || []).map((e) => ({
        ...e,
        entity_type: 'invoice' as const,
        entity_id: invoiceId,
      }));
    } catch (error) {
      this.logger.error('Error fetching invoice emails:', error?.response?.data);
      return [];
    }
  }

  public async getEstimateEmails(estimateId: string) {
    try {
      const { data } = await this.axios.get<ZohoEmailHistoryResponse>(
        `/estimates/${estimateId}/emails`,
      );
      return (data.email_history || []).map((e) => ({
        ...e,
        entity_type: 'estimate' as const,
        entity_id: estimateId,
      }));
    } catch (error) {
      this.logger.error('Error fetching estimate emails:', error?.response?.data);
      return [];
    }
  }

  public async syncContactPerson(
    zohoContactId: string,
    contact: {
      id: number;
      firstName: string;
      lastName: string;
      email?: string | null;
      phoneNumber?: string | null;
      functionality?: string | null;
      zohoPersonId?: string | null;
    },
  ) {
    if (!this.zohoConfig.refreshToken) return;

    try {
      const body: ZohoContactPersonRequest = {
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email || undefined,
        phone: contact.phoneNumber || undefined,
        designation: contact.functionality || undefined,
      };

      this.logger.log(`Syncing contact person for zohoContactId=${zohoContactId}: ${JSON.stringify(body)}`);
      if (contact.zohoPersonId) {
        const { data } = await this.axios.put(
          `/contacts/${zohoContactId}/contactpersons/${contact.zohoPersonId}`,
          body,
        );
        this.logger.log(`Update contact person response: ${JSON.stringify(data)}`);
      } else {
        const { data } = await this.axios.post<ZohoContactPersonResponse>(
          `/contacts/${zohoContactId}/contactpersons`,
          body,
        );
        this.logger.log(`Create contact person response: ${JSON.stringify(data)}`);
        if (data.contact_person?.contact_person_id) {
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: { zohoPersonId: data.contact_person.contact_person_id },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Error syncing Zoho contact person: ${JSON.stringify(error?.response?.data ?? error?.message ?? error)}`,
      );
    }
  }

  public async syncAllContactPersons(
    zohoContactId: string,
    contacts: {
      id: number;
      firstName: string;
      lastName: string;
      email?: string | null;
      phoneNumber?: string | null;
      functionality?: string | null;
      zohoPersonId?: string | null;
    }[],
  ) {
    for (const contact of contacts) {
      await this.syncContactPerson(zohoContactId, contact);
    }
  }

  public async getDashboardStats(): Promise<{ totalRevenue: number; emailsCount: number }> {
    if (!this.zohoConfig.refreshToken) return { totalRevenue: 0, emailsCount: 0 };

    let totalRevenue = 0;
    let emailsCount = 0;

    try {
      // Fetch all invoices (paginated, max 200 per page)
      let page = 1;
      while (true) {
        const { data } = await this.axios.get<ZohoListResponse<ZohoInvoice>>('/invoices', {
          params: { page, per_page: 200 },
        });
        const invoices = data.invoices || [];
        if (!invoices.length) break;
        for (const inv of invoices) {
          totalRevenue += inv.total || 0;
          emailsCount += 1; // count each invoice as an email interaction
        }
        if (invoices.length < 200) break;
        page++;
      }
    } catch (error) {
      this.logger.error('Error fetching Zoho invoices for dashboard:', error?.response?.data);
    }

    try {
      // Fetch all estimates (paginated)
      let page = 1;
      while (true) {
        const { data } = await this.axios.get<ZohoListResponse<ZohoEstimate>>('/estimates', {
          params: { page, per_page: 200 },
        });
        const estimates = data.estimates || [];
        if (!estimates.length) break;
        for (const _est of estimates) {
          emailsCount += 1;
        }
        if (estimates.length < 200) break;
        page++;
      }
    } catch (error) {
      this.logger.error('Error fetching Zoho estimates for dashboard:', error?.response?.data);
    }

    return { totalRevenue, emailsCount };
  }

  public async getContactEmails(zohoContactId: string) {
    const invoicesRaw: ZohoInvoice[] = [];
    const estimatesRaw: ZohoEstimate[] = [];

    try {
      const { data } = await this.axios.get<ZohoListResponse<ZohoInvoice>>(
        '/invoices',
        { params: { customer_id: zohoContactId } },
      );
      invoicesRaw.push(...(data.invoices || []));
    } catch (error) {
      this.logger.error('Error fetching invoices for email history:', error?.response?.data);
    }

    try {
      const { data } = await this.axios.get<ZohoListResponse<ZohoEstimate>>(
        '/estimates',
        { params: { customer_id: zohoContactId } },
      );
      estimatesRaw.push(...(data.estimates || []));
    } catch (error) {
      this.logger.error('Error fetching estimates for email history:', error?.response?.data);
    }

    const emailPromises = [
      ...invoicesRaw.map((inv) => this.getInvoiceEmails(inv.invoice_id)),
      ...estimatesRaw.map((est) => this.getEstimateEmails(est.estimate_id)),
    ];

    const results = await Promise.allSettled(emailPromises);
    const allEmails = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r: PromiseFulfilledResult<any>) => r.value);

    return allEmails;
  }
}
