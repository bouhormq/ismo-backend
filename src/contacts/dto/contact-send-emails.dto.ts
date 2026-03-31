import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const contactSendEmailsSchema = z.strictObject({
  template: z.string(),
  object: z.string(),
  message: z.string(),
  documents: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    }),
  ),
  contactIds: z.array(z.number()).optional(),
  articleIds: z.array(z.number()).optional(),
  sendCatalog: z.boolean().optional(),
  selectedIds: z.array(z.number()).optional(),
});

export class ContactSendEmailsDto extends createZodDto(
  contactSendEmailsSchema,
) {}
