import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

const UpdateArticle = z.object({
  title: z
    .string()
    .refine((val) => val === '' || val.length >= 3, {
      message: "Le titre de l'article doit contenir au moins 3 caractères",
    })
    .optional(),
  reference: z.string().optional().nullable(),
  equipmentCondition: z.string().optional().nullable(),
  industry: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
  }),
  category: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
  section: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
  availability: z.string().optional().nullable(),

  company: z.number({
    message: 'Vous devez sélectionner une société',
  }),

  purchasePriceWithoutTVA: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  HSCode: z.string().optional().nullable(),
  marginRate: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  purchasePriceWithTVA: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  sellingPriceWithoutTVA: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  sellingPriceWithTVA: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),

  description: z.string().nullable().optional(),
  catalogDescription: z.string().nullable().optional(),
  photos: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        url: z.string().optional(),
        description: z.string().optional().nullable(),
        status: z.string().optional(),
      }),
    )
    .optional(),

  isCompleted: z.boolean().optional(),
});

export class UpdateArticleDto extends createZodDto(UpdateArticle) {}
