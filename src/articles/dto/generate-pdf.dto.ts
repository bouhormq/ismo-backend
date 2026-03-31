import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const generateArticlesPdfSchema = z.strictObject({
  articleIds: z.array(z.number()),
});

export class GenerateArticlesPdfDto extends createZodDto(
  generateArticlesPdfSchema,
) {
  articleIds: number[];
}
