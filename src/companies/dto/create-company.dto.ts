import { createZodDto } from '@anatine/zod-nestjs';
import { CompanyPotential, CompanyType } from '@prisma/client';
import { isEmailValid } from 'src/utils/functions/validations.functions';
import { z } from 'zod';

export const CreateCompany = z.strictObject({
  companyName: z
    .string({
      required_error: "Nom de l'entreprise ne doit pas être vide",
    })
    .min(3, "Nom de l'entreprise doit contenir au moins 3 caractères"),
  phoneNumber: z
    .string({
      message:
        "Le numéro de téléphone doit être valide et ne contenir que des chiffres (avec un '+' optionnel au début).",
    })
    .optional(),
  address: z.string().optional(),
  email: z
    .string()
    .refine((val) => (val === '' ? true : isEmailValid(val)), {
      message: 'E-mail invalide',
    })
    .optional(),
  compl: z.string().optional(),
  zipCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  website: z.string().optional(),
  country: z.string().optional().nullable(),
  siret: z.string().optional().nullable(),
  vatNumber: z.string().optional(),

  companyType: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
  code: z.string().optional(),
  followedBy: z
    .number({
      message: 'Le Suivi par ne doit pas être vide',
    })
    .optional(),
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
  activityDescription: z.string().optional(),

  companyPotential: z.nativeEnum(CompanyPotential),
  contactOrigin: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
  industries: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  categories: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),

  sections: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),

  lastProspectionCall: z.string().optional(),
});

export class CreateCompanyDto extends createZodDto(CreateCompany) {
  companyName: string;
  companyPotential: CompanyPotential;
}
