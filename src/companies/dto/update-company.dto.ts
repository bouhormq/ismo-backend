import { createZodDto } from '@anatine/zod-nestjs';
import { CompanyPotential, CompanyType } from '@prisma/client';
import { isEmailValid } from 'src/utils/functions/validations.functions';
import { z } from 'zod';

export const UpdateCompany = z.strictObject({
  companyName: z
    .string()
    .refine((val) => val === '' || val.length >= 3, {
      message: "Nom de l'entreprise doit contenir au moins 3 caractères",
    })
    .optional(),
  phoneNumber: z
    .string({
      message:
        "Le numéro de téléphone doit être valide et ne contenir que des chiffres (avec un '+' optionnel au début).",
    })
    .optional()
    .nullable(),
  address: z.string().optional().nullable(),
  email: z
    .string()
    .refine((val) => (val === '' ? true : isEmailValid(val)), {
      message: 'E-mail invalide',
    })
    .optional()
    .nullable(),
  compl: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  siret: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),

  companyType: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
    })
    .optional()
    .nullable(),
  code: z.string().optional(),
  followedBy: z
    .number({
      message: 'Le Suivi par ne doit pas être vide',
    })
    .optional()
    .nullable(),
  usedItems: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  desiredItems: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  activityDescription: z.string().optional().nullable(),

  companyPotential: z.nativeEnum(CompanyPotential),
  contactOrigin: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
    })
    .optional()
    .nullable(),
  industries: z.array(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
    }),
  ),
  sections: z.array(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
    }),
  ),
  documents: z
    .array(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        url: z.string().optional(),
        description: z.string().optional().nullable(),
        status: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),

  contacts: z
    .array(
      z.object({
        id: z.number().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(),
        phoneNumber: z.string().optional(),
        status: z.string().optional(),
        functionality: z.string().optional(),
        note: z.string().optional(),
        gender: z.enum(['MALE', 'FEMALE']).optional(),
        hasWhatsapp: z.boolean().optional(),
      }),
    )
    .optional()
    .nullable(),

  memo: z.string().optional().nullable(),
  lastProspectionCall: z.string().optional().nullable(),
});

export class UpdateCompanyDto extends createZodDto(UpdateCompany) {}
