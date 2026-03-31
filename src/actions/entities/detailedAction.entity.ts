import { Prisma } from '@prisma/client';
import { getTime } from 'src/utils/functions/date/date.functions';

type FullActionType = Prisma.ActionGetPayload<{
  select: {
    id: true;
    createdAt: true;
    isDone: true;
    object: true;
    description: true;
    startDate: true;
    endDate: true;
    alarmDate: true;
    companyContact: { select: { id: true; firstName: true; lastName: true } };
    actionType: { select: { id: true; name: true; color: true } };
    addedBy: { select: { id: true; name: true } };
    companyId: true;
  };
}>;

export function DetailedActionTransformer(data: FullActionType) {
  const { companyContact, ...rest } = data;
  return {
    ...rest,
    ...(companyContact && {
      contact: {
        id: companyContact.id,
        name: `${companyContact.firstName} ${companyContact.lastName}`,
      },
    }),
    startDate: data.startDate.toISOString().split('T')[0],
    startDateTime: getTime(data.startDate),
    endDate: data.endDate
      ? data.endDate.toISOString().split('T')[0]
      : undefined,
    endDateTime: data.endDate ? getTime(data.endDate) : undefined,
    alarmDate: data.alarmDate
      ? data.alarmDate.toISOString().split('T')[0]
      : undefined,
    alarmDateTime: data.alarmDate ? getTime(data.alarmDate) : undefined,
  };
}
