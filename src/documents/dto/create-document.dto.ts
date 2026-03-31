import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateDocument = z.strictObject({
  name: z.string({
    required_error: 'Le nom du document ne doit pas être vide',
  }),
  description: z.string().optional().nullable(),
  url: z.string({
    required_error: "L'url du document ne doit pas être vide",
  }),
  companyId: z
    .number({
      required_error: "L'identifiant de l'entreprise ne doit pas être vide",
    })
    .optional(),
});

export class CreateDocumentDto extends createZodDto(CreateDocument) {
  name: string;
  url: string;
}
