import { Prisma } from '@prisma/client';
import type { DeepPartial } from 'src/types/util.types';

type FullActionType = Prisma.ActionGetPayload<{
  include: {
    addedBy: {
      select: {
        name: true;
      };
    };
    actionType: {
      select: {
        name: true;
      };
    };
    company: {
      select: {
        companyName: true;
      };
    };
  };
}>;

export function companyActionReportTableTransformer(
  data: DeepPartial<FullActionType>,
) {
  return {
    id: data.id,
    companyName: data.company.companyName,
    actionType: data.actionType.name,
    addedBy: data.addedBy.name,
    startDate: data.startDate,
    endDate: data.endDate,
    object: data.object,
    isDone: data.isDone,
  };
}
