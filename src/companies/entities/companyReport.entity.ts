import { CompanyPotentialUpdateLog, Prisma } from '@prisma/client';
import type { DeepPartial } from 'src/types/util.types';

type FullCompanyType = Prisma.CompanyGetPayload<{
  include: {
    categories: true;
    industries: true;
    sections: true;
    companyPotentialUpdateLogs: true;
  };
}>;

export const getDaysForLogs = (cp?: Partial<CompanyPotentialUpdateLog>) => {
  return String(
    cp
      ? (
          (Number(cp.time) + (new Date().getTime() - cp.updatedAt.getTime())) /
          (1000 * 60 * 60 * 24)
        ).toFixed(0)
      : 0,
  );
};

export function companyReportTableTransformer(
  data: DeepPartial<FullCompanyType>,
) {
  const cps: {
    availableEquipment?: Partial<CompanyPotentialUpdateLog>;
    neutral?: Partial<CompanyPotentialUpdateLog>;
    materialRequest?: Partial<CompanyPotentialUpdateLog>;
    projectStudy?: Partial<CompanyPotentialUpdateLog>;
    negotiation?: Partial<CompanyPotentialUpdateLog>;
    conclusion?: Partial<CompanyPotentialUpdateLog>;
  } = {
    availableEquipment: data.companyPotentialUpdateLogs.find(
      (log) => log.companyPotential === 'AVAILABLE_EQUIPMENT',
    ),
    neutral: data.companyPotentialUpdateLogs.find(
      (log) => log.companyPotential === 'NEUTRAL',
    ),
    materialRequest: data.companyPotentialUpdateLogs.find(
      (log) => log.companyPotential === 'MATERIAL_REQUEST',
    ),
    projectStudy: data.companyPotentialUpdateLogs.find(
      (log) => log.companyPotential === 'PROJECT_STUDY',
    ),
    negotiation: data.companyPotentialUpdateLogs.find(
      (log) => log.companyPotential === 'NEGOTIATION',
    ),
    conclusion: data.companyPotentialUpdateLogs.find(
      (log) => log.companyPotential === 'CONCLUSION',
    ),
  };

  return {
    id: data.id,
    name: data.companyName,
    companyPotential: data.companyPotential,
    industry: data.industries.map((industry) => industry.name).join(', '),
    category: data.categories.map((category) => category.name).join(', '),
    section: data.sections.map((section) => section.name).join(', '),

    daysSpentInAvailableEquipment: getDaysForLogs(cps.availableEquipment),
    daysSpentInNeutral: getDaysForLogs(cps.neutral),
    daysSpentInMaterialRequest: getDaysForLogs(cps.materialRequest),
    daysSpentInProjectStudy: getDaysForLogs(cps.projectStudy),
    daysSpentInNegotiation: getDaysForLogs(cps.negotiation),
    daysSpentInConclusion: getDaysForLogs(cps.conclusion),
  };
}
