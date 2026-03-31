import { Prisma } from '@prisma/client';
import { formatDate } from 'date-fns';

export const ARTICLES_HEADERS = {
  title: 'Titre',
  reference: 'Référence',
  equipmentCondition: 'État du matériel',
  createdAt: 'Date de création',
  updatedAt: 'Date de modification',
  industry: 'Industrie',
  section: 'Rubrique',
  category: 'Catégorie',
  availability: 'Disponibilité',
  companyName: 'Société',
  companyCode: 'Code Société',
  companyAddress: 'Adresse Société',
  companyZipCode: 'Code Postal Société',
  companyCountry: 'Pays Société',
  companyCity: 'Ville Société',
  purchasePriceWithoutTVA: "Prix d'achat (HT)",
  HSCode: 'HS Code',
  marginRate: 'Taux de marge',
  purchasePriceWithTVA: "Prix d'achat (TTC)",
  sellingPriceWithoutTVA: 'Prix de vente (HT)',
  sellingPriceWithTVA: 'Prix de vente (TTC)',
};

export const CONTACTS_HEADERS = {
  gender: 'Civilitie',
  firstName: 'Prénom',
  lastName: 'Nom',
  functionality: 'Fonctionnalité',
  phoneNumber: 'GSM',
  hasWhatsapp: 'Whatsapp',
  note: 'Note',
};

type FullArticleType = Prisma.ArticleGetPayload<{
  include: {
    company: {
      select: {
        companyName: true;
        country: true;
        city: true;
        code: true;
        zipCode: true;
        address: true;
        contacts: {
          select: {
            gender: true;
            firstName: true;
            lastName: true;
            functionality: true;
            note: true;
            phoneNumber: true;
            hasWhatsapp: true;
          };
        };
      };
    };
    industry: { select: { name: true } };
    category: { select: { name: true } };
    section: { select: { name: true } };
  };
}>;

export function DetailedArticleExcelTransformer(data: FullArticleType) {
  return {
    title: data.title,
    reference: data.reference,
    equipmentCondition: data.equipmentCondition,
    createdAt: formatDate(new Date(data.createdAt), 'dd/MM/yyyy'),
    updatedAt: formatDate(new Date(data.updatedAt), 'dd/MM/yyyy'),
    industry: data.industry.name,
    section: data.section.name,
    category: data.category.name,
    availability:
      data.availability === 'available' ? 'Disponible' : 'Non disponible',
    companyName: data.company?.companyName,
    companyCode: data.company?.code,
    companyAddress: data.company?.address,
    companyZipCode: data.company?.zipCode,
    companyCountry: data.company?.country,
    companyCity: data.company?.city,
    purchasePriceWithoutTVA: data.purchasePriceWithoutTVA
      ? data.purchasePriceWithoutTVA + ' €'
      : 'N/A',
    HSCode: data.HSCode,
    marginRate: data.marginRate,
    purchasePriceWithTVA: data.purchasePriceWithTVA
      ? data.purchasePriceWithTVA + ' €'
      : 'N/A',
    sellingPriceWithoutTVA: data.sellingPriceWithoutTVA
      ? data.sellingPriceWithoutTVA + ' €'
      : 'N/A',
    sellingPriceWithTVA: data.sellingPriceWithTVA
      ? data.sellingPriceWithTVA + ' €'
      : 'N/A',
    contacts: (data.company?.contacts ?? []).map((contact) => ({
      companyName: data.company.companyName,
      gender: contact.gender === 'MALE' ? 'Monsieur' : 'Madame',
      firstName: contact.firstName,
      lastName: contact.lastName,
      functionality: contact.functionality,
      phoneNumber: contact.phoneNumber,
      hasWhatsapp: contact.hasWhatsapp ? 'Oui' : 'Non',
      note: contact.note,
    })),
  };
}
