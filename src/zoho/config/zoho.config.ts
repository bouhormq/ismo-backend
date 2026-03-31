import { Injectable } from '@nestjs/common';

@Injectable()
export class ZohoConfig {
  public clientId: string = process.env.ZOHO_CLIENT_ID;
  public clientSecret: string = process.env.ZOHO_CLIENT_SECRET;
  public refreshToken: string = process.env.ZOHO_REFRESH_TOKEN;
  public organizationId: string = process.env.ZOHO_ORGANIZATION_ID;
  public baseUrl: string =
    process.env.ZOHO_BASE_URL || 'https://www.zohoapis.eu/books/v3';
  public accountsUrl: string =
    process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.eu';
}
