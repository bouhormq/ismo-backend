import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const UpdateDocument = z.strictObject({
  name: z
    .string({
      required_error: 'Le nom du document ne doit pas être vide',
    })
    .optional(),
  description: z
    .string({
      required_error: 'La description du document ne doit pas être vide',
    })
    .optional(),
  url: z
    .string({
      required_error: "L'url du document ne doit pas être vide",
    })
    .optional(),
});

export class UpdateDocumentDto extends createZodDto(UpdateDocument) {
  id: number;
}
