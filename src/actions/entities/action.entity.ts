import { Prisma } from '@prisma/client';
import type { DeepPartial } from 'src/types/util.types';

type FullActionType = Prisma.ActionGetPayload<{
  include: {
    addedBy: true;
    actionType: true;
  };
}>;

export function CompanyActionsTableTransformer(
  data: DeepPartial<FullActionType>,
) {
  return {
    id: data.id,
    isDone: data.isDone,
    object: data.object,
    actionType: data.actionType.name,
    addedBy: data.addedBy.name,
    createdAt: data.createdAt,
  };
}
