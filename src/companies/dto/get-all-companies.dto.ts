import { createZodDto } from '@anatine/zod-nestjs';
import { CompanyPotential } from '@prisma/client';
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
  relationType: z.enum(['company', 'article']).optional(),
});

export const searchablePaginationSchema = paginationSchema.extend({
  search: z.string().optional(),
  include: z.array(z.number()).optional(),
  companyPotential: z.nativeEnum(CompanyPotential).optional(),
  categories: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  contactOrigin: z
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
  followedBy: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  companyType: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  usedItems: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),
  desiredItems: z
    .string()
    .transform((val) => Number.parseInt(val))
    .optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastProspectionCall: z.string().optional(),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

export class GetAllCompaniesDto extends createZodDto(
  searchablePaginationSchema,
) {}
