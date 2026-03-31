import { Prisma } from '@prisma/client';
import type { DeepPartial } from 'src/types/util.types';

type FullCompanyType = Prisma.CompanyGetPayload<{
  include: {
    categories: true;
    contactOrigin: true;
    followedBy: true;
    industries: true;
    sections: true;
    actions: true;
  };
}>;

export function companyTableTransformer(data: DeepPartial<FullCompanyType>) {
  return {
    id: data.id,
    phoneNumber: data.phoneNumber,
    name: data.companyName,
    companyPotential: data.companyPotential,
    code: data.code,
    country: data.country,
    category: !!data.categories.length
      ? data.categories[data.categories.length - 1].name
      : '-',
    section: !!data.sections.length
      ? data.sections[data.sections.length - 1].name
      : '-',
    latestAction: !!data.actions.length
      ? data.actions[data.actions.length - 1].object
      : '-',
    lastProspectionCall: data.lastProspectionCall,
    createdAt: data.createdAt,
  };
}
