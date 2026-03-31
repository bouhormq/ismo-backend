import { createZodDto } from '@anatine/zod-nestjs';
import { paginationSchema } from 'src/companies/dto/get-all-companies.dto';
import { z } from 'zod';

export const documentsPaginationSchema = paginationSchema.extend({
  search: z.string().optional(),
});

export class GetAllDocumentsDto extends createZodDto(
  documentsPaginationSchema,
) {}
