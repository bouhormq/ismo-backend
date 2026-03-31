import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const generateCompaniesPdfSchema = z.strictObject({
  companiesIds: z.array(z.number()),
});

export class GenerateCompaniesPdfDto extends createZodDto(
  generateCompaniesPdfSchema,
) {
  companiesIds: number[];
}
