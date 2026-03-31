import { Prisma } from '@prisma/client';

type FullCompanyType = Prisma.CompanyGetPayload<{
  include: {
    categories: { select: { id: true; name: true } };
    contactOrigin: { select: { id: true; name: true } };
    followedBy: { select: { id: true; name: true } };
    industries: { select: { id: true; name: true } };
    sections: { select: { id: true; name: true } };
    usedItems: { select: { id: true; name: true } };
    desiredItems: { select: { id: true; name: true } };
    companyType: { select: { id: true; name: true } };
  };
}>;

export function DetailedCompanyTransformer(data: FullCompanyType) {
  return {
    ...data,
    industries: data.industries.map(({ id, name }) => ({ value: id, name })),
    categories: data.categories.map(({ id, name }) => ({ value: id, name })),
    sections: data.sections.map(({ id, name }) => ({ value: id, name })),
    usedItems: data.usedItems.map(({ id, name }) => ({ value: id, name })),
    desiredItems: data.desiredItems.map(({ id, name }) => ({
      value: id,
      name,
    })),
  };
}
