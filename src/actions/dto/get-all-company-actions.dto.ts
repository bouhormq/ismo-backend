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

  companyId: z.string().transform((val) => Number.parseInt(val)),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GetAllCompanyActionsDto extends createZodDto(
  searchablePaginationSchema,
) {}
