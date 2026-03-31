import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateArticle = z.strictObject({
  title: z
    .string()
    .min(3, "Le titre de l'article doit contenir au moins 3 caractères"),
  equipmentCondition: z.string().optional(),
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
  HSCode: z.string().optional(),
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

  description: z.string().optional(),
  catalogDescription: z.string().optional(),
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
});

export class CreateArticleDto extends createZodDto(CreateArticle) {
  title: string;
}
