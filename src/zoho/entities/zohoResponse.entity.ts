import { ZohoEstimate, ZohoInvoice } from '../type/zoho.type';

const ZOHO_ORG_ID = '20113082758';

function mapZohoStatusToFrench(status: string, type: 'invoice' | 'estimate') {
  if (type === 'invoice') {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'sent':
        return 'Envoyé';
      case 'overdue':
        return 'En retard';
      case 'paid':
        return 'Payé';
      case 'partially_paid':
        return 'Partiellement payé';
      case 'void':
        return 'Annulé';
      default:
        return status;
    }
  }

  switch (status) {
    case 'draft':
      return 'Brouillon';
    case 'sent':
      return 'Envoyé';
    case 'invoiced':
      return 'Facturé';
    case 'accepted':
      return 'Accepté';
    case 'declined':
      return 'Refusé';
    case 'expired':
      return 'Expiré';
    default:
      return status;
  }
}

export function zohoInvoiceTableTransformer(data: ZohoInvoice) {
  return {
    reference: data.invoice_id,
    number: data.invoice_number,
    title: data.salesperson_name || '-',
    createdAt: new Date(data.date),
    total_amount: data.total,
    pdf_url: `https://books.zoho.eu/api/v3/invoices/${data.invoice_id}?accept=pdf&organization_id=${ZOHO_ORG_ID}`,
    customer_portal_url: data.invoice_url || '',
    status: mapZohoStatusToFrench(data.status, 'invoice'),
    type: data.status === 'draft' ? 'Facture Proforma' : 'Facture',
    view_link: `https://books.zoho.eu/app/${ZOHO_ORG_ID}#/invoices/${data.invoice_id}`,
    product_name: data.line_items?.[0]?.name || '-',
    source: 'zoho' as const,
  };
}

export function zohoEstimateTableTransformer(data: ZohoEstimate) {
  return {
    reference: data.estimate_id,
    number: data.estimate_number,
    title: data.salesperson_name || '-',
    createdAt: new Date(data.date),
    total_amount: data.total,
    pdf_url: `https://books.zoho.eu/api/v3/estimates/${data.estimate_id}?accept=pdf&organization_id=${ZOHO_ORG_ID}`,
    customer_portal_url: '',
    status: mapZohoStatusToFrench(data.status, 'estimate'),
    type: 'Devis',
    view_link: `https://books.zoho.eu/app/${ZOHO_ORG_ID}#/quotes/${data.estimate_id}`,
    product_name: data.line_items?.[0]?.name || '-',
    source: 'zoho' as const,
  };
}
