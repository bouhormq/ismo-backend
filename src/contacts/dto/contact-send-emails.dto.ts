import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const contactSendEmailsSchema = z.strictObject({
  template: z.string().optional(),
  object: z.string(),
  message: z.string(),
  documents: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    }),
  ),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  contactIds: z.array(z.number()).optional(),
  articleIds: z.array(z.number()).optional(),
  sendCatalog: z.boolean().optional(),
  selectedIds: z.array(z.number()).optional(),
});

export class ContactSendEmailsDto extends createZodDto(
  contactSendEmailsSchema,
) {}
