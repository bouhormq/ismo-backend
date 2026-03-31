import { Prisma } from '@prisma/client';
import { COMPANY_POTENTIAL_OPTIONS } from 'src/utils/constants/companies.contants';

export const COMPANIES_HEADERS = {
  companyName: 'Nom société',
  phoneNumber: 'Téléphone',
  address: 'Adresse société',
  email: 'Email',
  compl: 'Compl',
  country: 'Pays',
  city: 'Ville',
  website: 'Site Web',
  zipCode: 'Code Postal',
  siretNumber: 'Numéro siret',
  tvaNumber: 'Numéro TVA',
  companyType: 'Type de Fiche',
  code: 'Code',
  followedBy: 'Suivi par',
  usedItems: 'Article Utilisé',
  desiredItems: 'Article Désiré',
  description: "Descriptif de l'activité",
  companyPotential: 'Potentiel de la société',
  contactOrigin: 'Origine du contact',
  industries: 'Industrie',
  categories: 'Catégorie',
  sections: 'Rubrique',
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

type FullCompanyType = Prisma.CompanyGetPayload<{
  include: {
    categories: { select: { name: true } };
    contactOrigin: { select: { name: true } };
    followedBy: { select: { name: true } };
    industries: { select: { name: true } };
    sections: { select: { name: true } };
    usedItems: { select: { name: true } };
    desiredItems: { select: { name: true } };
    companyType: { select: { name: true } };
    contacts: {
      select: {
        firstName: true;
        lastName: true;
        email: true;
        note: true;
        functionality: true;
        gender: true;
        hasWhatsapp: true;
        phoneNumber: true;
      };
    };
  };
}>;

export function DetailedCompanyExcelTransformer(data: FullCompanyType) {
  return {
    companyName: data.companyName,
    phoneNumber: data.phoneNumber,
    address: data.address,
    email: data.email,
    compl: data.compl,
    country: data.country,
    city: data.city,
    website: data.website,
    zipCode: data.zipCode,
    siretNumber: data.siret,
    tvaNumber: data.vatNumber,
    companyType: data.companyType ? data.companyType.name : '-',
    code: data.code,
    followedBy: data.followedBy ? data.followedBy.name : '-',
    usedItems: data.usedItems.map(({ name }) => name).join(', '),
    desiredItems: data.desiredItems.map(({ name }) => name).join(', '),
    description: data.activityDescription,
    companyPotential: COMPANY_POTENTIAL_OPTIONS[data.companyPotential],
    contactOrigin: data.contactOrigin ? data.contactOrigin.name : '-',
    industries: data.industries.map(({ name }) => name).join(', '),
    categories: data.categories.map(({ name }) => name).join(', '),
    sections: data.sections.map(({ name }) => name).join(', '),
    contacts: data.contacts.map((contact) => ({
      companyName: data.companyName,
      gender: contact.gender === 'MALE' ? 'Monsieur' : 'Madame',
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      functionality: contact.functionality,
      phoneNumber: contact.phoneNumber,
      hasWhatsapp: contact.hasWhatsapp ? 'Oui' : 'Non',
      note: contact.note,
    })),
  };
}
