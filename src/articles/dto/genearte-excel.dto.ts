import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const paginationSchema = z.strictObject({
  offset: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  limit: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
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
  companyContactOrigin: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  companyName: z.string().optional(),
  companyCountry: z.string().optional(),
  companyCity: z.string().optional(),

  selectedIds: z.array(z.number()).optional(),

  isCompleted: z.string().optional(),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GenerateArticlesExcelDto extends createZodDto(
  searchablePaginationSchema,
) {}
