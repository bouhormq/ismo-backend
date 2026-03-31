import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const paginationSchema = z.strictObject({
  offset: z.string().transform((val) => Number.parseInt(val)),
  limit: z.string().transform((val) => Number.parseInt(val)),
  key: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const searchablePaginationSchema = paginationSchema.extend({
  search: z.string().optional(),
  include: z.array(z.number()).optional(),
  title: z.string().optional(),
  section: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  equipmentCondition: z.string().optional(),
  companyName: z.string().optional(),
  category: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  industry: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  availability: z.string().optional(),
  reference: z.string().optional(),
  companyCountry: z.string().optional(),
  companyCity: z.string().optional(),
  isCompleted: z.string().optional(),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GetAllArticlesDto extends createZodDto(
  searchablePaginationSchema,
) {}
