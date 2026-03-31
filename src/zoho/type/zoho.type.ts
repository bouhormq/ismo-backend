export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  status: string;
  total: number;
  balance: number;
  customer_id: string;
  customer_name: string;
  invoice_url: string;
  currency_code: string;
  created_time: string;
  last_modified_time: string;
  reference_number: string;
  line_items: ZohoLineItem[];
  salesperson_name: string;
}

export interface ZohoLineItem {
  item_id: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  item_total: number;
  tax_percentage: number;
}

export interface ZohoEstimate {
  estimate_id: string;
  estimate_number: string;
  date: string;
  expiry_date: string;
  status: string;
  total: number;
  customer_id: string;
  customer_name: string;
  reference_number: string;
  currency_code: string;
  created_time: string;
  last_modified_time: string;
  line_items: ZohoLineItem[];
  salesperson_name: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
}

export interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ZohoContactCreateRequest {
  contact_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  billing_address?: {
    address?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  contact_type: 'customer';
  contact_persons?: ZohoContactPersonRequest[];
}

export interface ZohoContactResponse {
  code: number;
  message: string;
  contact: ZohoContact;
}

export interface ZohoContactsListResponse {
  code: number;
  message: string;
  contacts: ZohoContact[];
}

export interface ZohoListResponse<T> {
  code: number;
  message: string;
  invoices?: T[];
  estimates?: T[];
}

export interface ZohoEmailRequest {
  send_from_org_email_id: boolean;
  to_mail_ids: string[];
  cc_mail_ids?: string[];
  subject: string;
  body: string;
}

export interface ZohoEmailHistoryEntry {
  email_id: string;
  to_mail_ids: string[];
  subject: string;
  date: string;
  mail_status: string;
  from_mail_id: string;
}

export interface ZohoEmailHistoryResponse {
  code: number;
  message: string;
  email_history: ZohoEmailHistoryEntry[];
}

export interface ZohoContactPersonRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  designation?: string;
}

export interface ZohoContactPerson {
  contact_person_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  designation?: string;
}

export interface ZohoContactPersonResponse {
  code: number;
  message: string;
  contact_person: ZohoContactPerson;
}

export interface ZohoContactPersonsListResponse {
  code: number;
  message: string;
  contact_persons: ZohoContactPerson[];
}
