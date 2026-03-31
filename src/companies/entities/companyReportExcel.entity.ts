import { CompanyPotentialUpdateLog, Prisma } from '@prisma/client';
import { DeepPartial } from 'src/types/util.types';
import { getDaysForLogs } from './companyReport.entity';
import { COMPANY_POTENTIAL_OPTIONS } from 'src/utils/constants/companies.contants';

export const COMPANIES_REPORT_HEADERS = {
  name: 'Société',
  companyPotential: 'Potentiel Actuel',
  industry: 'Industrie',
  category: 'Catégorie',
  section: 'Rubrique',
  daysSpentInAvailableEquipment: 'Dispose matériel (jours)',
  daysSpentInProjectStudy: 'Étude du projet (jours)',
  daysSpentInNegotiation: 'Négociation (jours)',
  daysSpentInConclusion: 'Conclusion (jours)',
  daysSpentInNeutral: 'Neutre/Aucun (jours)',
  daysSpentInMaterialRequest: 'Demande de matériel (jours)',
};

type FullCompanyType = Prisma.CompanyGetPayload<{
  include: {
    categories: true;
    industries: true;
    sections: true;
    companyPotentialUpdateLogs: true;
  };
}>;

export function companyReportExcelTransformer(
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
    companyPotential: COMPANY_POTENTIAL_OPTIONS[data.companyPotential],
    industry: data.industries.map(({ name }) => name).join(', '),
    category: data.categories.map(({ name }) => name).join(', '),
    section: data.sections.map(({ name }) => name).join(', '),

    daysSpentInAvailableEquipment: getDaysForLogs(cps.availableEquipment),
    daysSpentInNeutral: getDaysForLogs(cps.neutral),
    daysSpentInMaterialRequest: getDaysForLogs(cps.materialRequest),
    daysSpentInProjectStudy: getDaysForLogs(cps.projectStudy),
    daysSpentInNegotiation: getDaysForLogs(cps.negotiation),
    daysSpentInConclusion: getDaysForLogs(cps.conclusion),
  };
}
