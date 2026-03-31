export interface AxonautResponse<T> {
  data: T;
}

export interface CompanyResponse {
  id: number;
  name: string;
  creation_date: string;
  address_street: string;
  address_zip_code: string;
  address_city: string;
  address_country: string;
  comments: string;
  is_supplier: boolean;
  is_prospect: boolean;
  is_customer: boolean;
  thirdparty_code: string;
  intracommunity_number: string;
  siret: string;
  internal_id: string;
  categories: string[];
  employees: {
    id: number;
    gender: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number: string;
    cellphone_number: string;
    job: string;
    custom_fields: string[];
  }[];
}

export interface ProductResponse {
  id: number;
  name: string;
  product_code: string;
  supplier_product_code: string;
  description: string;
  price: 0;
  price_with_tax: 0;
  tax_rate: 0;
  type: string;
  category: string;
  job_costing: 0;
  accounting_code: string;
  weight: 0;
  location: string;
  unit: string;
  disabled: true;
  internal_id: string;
  custom_fields: Record<string, never>;
}

export interface InvoiceResponse {
  id: 0;
  number: string;
  order_number: string;
  date: string;
  sent_date: string;
  due_date: string;
  paid_date: string;
  last_update_date: string;
  pre_tax_amount: 0;
  tax_amount: 0;
  total: 0;
  currency: string;
  mandatory_mentions: string;
  payment_terms: string;
  outstanding_amount: 0;
  service_start_date: string;
  service_end_date: string;
  frequency_in_months: 0;
  business_user: string;
  public_path: string;
  customer_portal_url: string;
  invoice_lines: [
    {
      product_id: 0;
      product_name: string;
      product_code: string;
      price: 0;
      quantity: 0;
      tax_rates: Record<string, unknown>;
      details: string;
      total_pre_tax_amount: 0;
      total_tax_amount: 0;
      total_amount: 0;
      accounting_code: string;
      unit_job_costing: 0;
    },
  ];
  company: {
    id: 0;
    name: string;
    is_supplier: true;
    is_prospect: true;
    is_customer: true;
  };
  billing_address: {
    company_name: string;
    contact_name: string;
    street: string;
    zip_code: string;
    city: string;
    region: string;
    country: string;
  };
  delivery_address: {
    company_name: string;
    contact_name: string;
    street: string;
    zip_code: string;
    city: string;
    region: string;
    country: string;
  };
  contract_id: Record<string, unknown>;
  quotation_id: Record<string, unknown>;
  project_id: Record<string, unknown>;
}
