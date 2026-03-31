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
  categories: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  industries: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  sections: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  companyName: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  companyPotential: z.string().optional(),
  done: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  actionType: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  addedBy: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  object: z.string().optional(),
  startDateRange: z.string().optional(),
  endDateRange: z.string().optional(),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GetAllCompaniesReportDto extends createZodDto(
  searchablePaginationSchema,
) {}
