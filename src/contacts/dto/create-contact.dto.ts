import { createZodDto } from '@anatine/zod-nestjs';
import { Gender } from '@prisma/client';
import { isEmailValid } from 'src/utils/functions/validations.functions';
import { z } from 'zod';

export const CreateContact = z.strictObject({
  firstName: z.string(),
  lastName: z.string(),
  email: z
    .string()
    .refine((val) => (val === '' || !val ? true : isEmailValid(val)), {
      message: 'E-mail invalide',
    })
    .optional(),
  phoneNumber: z.string(),
  functionality: z.string().optional(),
  note: z.string().optional(),
  gender: z.nativeEnum(Gender),
  hasWhatsapp: z.boolean(),
  companyId: z.number(),
});

export class CreateContactDto extends createZodDto(CreateContact) {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender: Gender;
  companyId: number;
}
