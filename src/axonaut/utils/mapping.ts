import { Company, Prisma, Product, User } from '@prisma/client';
import { TJSON } from 'src/types/util.types';
import { AxonautCustomer } from '../type/axonaut.type';

export type CompanyIncludeType = Prisma.CompanyGetPayload<{
  include: {
    contacts: true;
    desiredItems: true;
    usedItems: true;
    industries: true;
    sections: true;
    categories: true;
    contactOrigin: true;
  };
}>;

export const mapCompanyToAxonaut = (
  company: CompanyIncludeType,
): Partial<AxonautCustomer> => {
  const body: TJSON = {
    currency: 'EUR',
  };
  body.name = company.companyName;
  if (company.contacts.length > 0)
    body.address_contact_name = company.contacts[0].firstName;
  body.street = company.address;
  body.address_zip_code = company.zipCode;
  body.address_city = company.city;
  body.address_country = company.country;
  body.siret = company.siret;
  body.internal_id = company.id;
  return body;
};
