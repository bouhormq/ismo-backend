import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const getUploadPathSchema = z.object({
  path: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export class GetUploadPathDto extends createZodDto(getUploadPathSchema) {}
