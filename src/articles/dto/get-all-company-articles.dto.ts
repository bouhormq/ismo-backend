import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const paginationSchema = z.strictObject({
  offset: z.string().transform((val) => Number.parseInt(val)),
  limit: z.string().transform((val) => Number.parseInt(val)),
  key: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const searchablePaginationSchema = paginationSchema.extend({
  companyId: z.string().transform((val) => Number.parseInt(val)),
  search: z.string().optional(),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GetAllCompanyArticlesDto extends createZodDto(
  searchablePaginationSchema,
) {}
