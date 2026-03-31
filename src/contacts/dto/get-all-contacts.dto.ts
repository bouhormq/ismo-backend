import { createZodDto } from '@anatine/zod-nestjs';
import { paginationSchema } from 'src/companies/dto/get-all-companies.dto';
import { z } from 'zod';

export const contactsPaginationSchema = paginationSchema.extend({
  search: z.string().optional(),
});

export class GetAllContactsDto extends createZodDto(contactsPaginationSchema) {}
