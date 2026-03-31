import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateAction = z.strictObject({
  companyId: z.number(),
  contact: z
    .object({
      id: z.number(),
    })
    .optional()
    .nullable(),
  actionType: z.object({
    name: z.string().optional(),
    color: z.string().optional(),
    id: z.number().optional(),
  }),
  addedBy: z.object({ id: z.number() }),
  isDone: z.boolean(),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  alarmDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  object: z
    .string({ message: 'Ce champ ne peut pas être vide' })
    .min(1, { message: 'Ce champ ne peut pas être vide' }),
  description: z.string(),
});

export class CreateActionDto extends createZodDto(CreateAction) {
  object: string;
  description: string;
  startDate: Date;
  endDate: Date;
  alarmDate: Date;
}
