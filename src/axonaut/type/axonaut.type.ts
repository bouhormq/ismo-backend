interface CustomFields {
  myCustomField: number;
}

interface Employee {
  firstname: string;
  lastname: string;
  email: string;
  phoneNumber: string;
  cellphoneNumber: string;
  job: string;
  is_billing_contact: boolean;
  custom_fields: CustomFields;
}

export interface AxonautCustomer {
  name: string;
  address_contact_name: string;
  address_street: string;
  address_zip_code: string;
  address_city: string;
  address_country: string;
  is_prospect: boolean;
  is_customer: boolean;
  isB2C: boolean;
  employees: Employee[];
  currency: string;
  language: string;
  thirdparty_code: string;
  intracommunity_number: string;
  siret: string;
  comments: string;
  custom_fields: CustomFields;
  categories: string[];
  internal_id: string;
  business_manager: string;
}

export interface QuotationLine {
  product_id: number;
  product_internal_id: number | null;
  product_name: string;
  product_code: string;
  title: string;
  details: string;
  quantity: number;
  unit: string;
  price: number;
  tax_rates: TaxRate[];
  line_discount_amount: string;
  line_discount_amount_with_tax: string;
  line_discount_unit_is_percent: boolean;
  tax_amount: number;
  pre_tax_amount: number;
  total_amount: number;
  margin: number;
  unit_job_costing: number;
  chapter: string;
}

export interface TaxRate {
  rate: number;
  name: string;
}

export interface Quotation {
  id: number;
  number: string;
  title: string;
  date: string; // ISO date string
  expiry_date: string; // ISO date string
  sent_date: string | null;
  last_update_date: string;
  status: string;
  user_id: number;
  company_id: number;
  company_name: string;
  project_id: number | null;
  opportunity_id: number | null;
  contract_id: number | null;
  global_discount_amount: number;
  global_discount_amount_with_tax: number;
  global_discount_unit_is_percent: boolean | null;
  global_discount_comments: string | null;
  pre_tax_amount: number;
  tax_amount: number;
  total_amount: number;
  margin: number;
  payments_to_display_in_pdf: any | null;
  electronic_signature_date: string | null;
  comments: string;
  public_path: string;
  customer_portal_url: string;
  quotation_lines: QuotationLine[];
}

interface Deposit {
  deposit_percent: number | null;
  deposit_flat: number | null;
}

interface Discounts {
  amount: number;
  amount_with_tax: number;
  comments: number;
}

interface Tax {
  rate: number;
  amount: number;
}

interface InvoiceLineTaxRate {
  id: number;
  rate: number;
  name: string;
  accounting_code: string | null;
}

interface InvoiceLineDiscounts {
  amount: number;
  amount_with_tax: number;
}

interface InvoiceLine {
  product_id: number;
  product_name: string;
  product_code: string | null;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  tax_rates: InvoiceLineTaxRate[];
  details: string;
  total_pre_tax_amount: number;
  total_tax_amount: number;
  total_amount: number;
  chapter: string | null;
  discounts: InvoiceLineDiscounts;
  accounting_code: string | null;
  unit_job_costing: number;
}

interface Company {
  id: number;
  name: string;
  is_supplier: boolean;
  is_prospect: boolean;
  is_customer: boolean;
}

interface Address {
  company_name: string;
  contact_name: string;
  street: string;
  zip_code: string;
  city: string;
  region: string;
  country: string;
}

export interface Invoice {
  id: number;
  number: string;
  order_number: string | null;
  date: string;
  sent_date: string | null;
  due_date: string;
  paid_date: string | null;
  delivery_date: string | null;
  last_update_date: string;
  pre_tax_amount: number;
  tax_amount: number;
  total: number;
  deposits: Deposit;
  discounts: Discounts;
  taxes: Tax[];
  currency: string;
  margin: number;
  mandatory_mentions: string;
  payment_terms: string;
  theme_id: number;
  outstanding_amount: number;
  frequency_in_months: number | null;
  business_user: string;
  public_path: string;
  paid_invoice_pdf: string | null;
  customer_portal_url: string;
  invoice_lines: InvoiceLine[];
  company: Company;
  billing_address: Address;
  delivery_address: Address;
  contract_id: number | null;
  project_id: number | null;
}
