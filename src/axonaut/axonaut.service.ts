import { Injectable } from '@nestjs/common';

import axios, { AxiosError, AxiosInstance } from 'axios';

import { CompanyIncludeType, mapCompanyToAxonaut } from './utils/mapping';
import { DatabaseService } from 'src/database/database.service';
import { AxonautConfig } from './config/axonaut.config';
import { AxonautCustomer, Invoice, Quotation } from './type/axonaut.type';
import { transformObject } from 'src/utils/functions/misc.functions';
import {
  axonautInvoicesResponseTableTransformer,
  axonautQuotationsResponseTableTransformer,
} from './entities/axonautQuotationsResponse.entity';
import { AxonautResponse, CompanyResponse } from './type/response.type';
import { TJSON } from 'src/types/util.types';

@Injectable()
export class AxonautService {
  private axios: AxiosInstance;
  constructor(
    private prisma: DatabaseService,
    private readonly axonautConfig: AxonautConfig,
  ) {
    this.axios = axios.create({
      baseURL: this.axonautConfig.baseUrl,
      headers: { userApiKey: this.axonautConfig.apiKey },
    });
  }

  public async updateOrRegisterCompany(company: CompanyIncludeType) {
    console.log('HERE', company.axonautId);
    if (company.axonautId) {
      return this.updateCompany(company);
    } else {
      return this.registerCompany(company);
    }
  }

  public async getCompanyOffers(axonautId: string) {
    let quotationsRawData: Quotation[] = [];

    try {
      const quotationsRawResponse = await this.axios.get<Quotation[]>(
        `/companies/${axonautId}/quotations`,
        {
          headers: {
            userApiKey: this.axonautConfig.apiKey,
          },
        },
      );
      quotationsRawData = quotationsRawResponse.data;
    } catch (error) {
      console.error('Error fetching quotations:', error.response);
    }
    let invoicesRawData: Invoice[] = [];
    try {
      const invoicesRawResponse = await this.axios.get<Invoice[]>(
        `/companies/${axonautId}/invoices`,
        {
          headers: {
            userApiKey: this.axonautConfig.apiKey,
          },
        },
      );
      invoicesRawData = invoicesRawResponse.data;
    } catch (error) {
      console.error('Error fetching invoices:', error.response);
    }

    const quotations = transformObject(
      quotationsRawData,
      axonautQuotationsResponseTableTransformer,
    );

    const invoices = transformObject(
      invoicesRawData,
      axonautInvoicesResponseTableTransformer,
    );

    const data = [...quotations, ...invoices];
    return {
      data,
      count: data.length,
    };
  }

  private async registerCompany(company: CompanyIncludeType) {
    try {
      const companyBody = mapCompanyToAxonaut(company);
      const { data: axonautCompany } = await this.axios.post<
        Partial<AxonautCustomer>,
        AxonautResponse<CompanyResponse>
      >('/companies', companyBody);
      return await this.prisma.company.update({
        where: { id: company.id },
        data: { axonautId: String(axonautCompany.id) },
      });
    } catch (e) {
      console.log('ERROR in register', e);
    }
  }

  private async updateCompany(company: CompanyIncludeType) {
    try {
      const companyBody = mapCompanyToAxonaut(company);
      return await this.axios.patch<TJSON, AxonautResponse<CompanyResponse>>(
        `/companies/${company.axonautId}`,
        companyBody,
      );
    } catch (e) {
      console.log('ERROR in update', e.response);
    }
  }
}
