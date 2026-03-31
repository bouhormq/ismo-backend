import { DeepPartial } from 'src/types/util.types';
import { Invoice, Quotation } from '../type/axonaut.type';
function mapStatusToFrench(status: string) {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'sent':
      return 'Envoyé';
    case 'accepted':
      return 'Accepté';
    case 'refused':
      return 'Refusé';
    case 'expired':
      return 'Expiré';
    default:
      return status;
  }
}
export function axonautQuotationsResponseTableTransformer(
  data: DeepPartial<Quotation>,
) {
  return {
    reference: data.id,
    title: '-',
    number: data.number,
    status: mapStatusToFrench(data.status),
    total_amount: data.total_amount,
    pdf_url: data.public_path,
    customer_portal_url: data.customer_portal_url,
    createdAt: new Date(data.date),
    type: 'Devis',
    view_link: `https://axonaut.com/business/company/show/${data.company_id}`,
    product_name: data.quotation_lines[0].product_name,
    source: 'axonaut' as const,
  };
}

export function axonautInvoicesResponseTableTransformer(
  data: DeepPartial<Invoice>,
) {
  return {
    reference: data.id,
    number: data.number,
    title: data.business_user,
    createdAt: new Date(data.date),
    total_amount: data.invoice_lines[0].total_amount,
    pdf_url: data.paid_invoice_pdf,
    customer_portal_url: data.customer_portal_url,
    status: data.paid_date ? 'Payé' : 'Pas encore payé',
    type: 'Facture',
    view_link: `https://axonaut.com/business/company/show/${data.company.id}`,
    product_name: data.invoice_lines[0].product_name,
    source: 'axonaut' as const,
  };
}
