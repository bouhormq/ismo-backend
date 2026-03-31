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
  categories: z.number().optional(),
  industries: z.number().optional(),
  sections: z.number().optional(),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GetAllCompaniesReportExcelDto extends createZodDto(
  searchablePaginationSchema,
) {}
