import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const sendEmailingSchema = z.strictObject({
  template: z.string(),
  companyIds: z.array(z.number()),
});

export class SendEmailingDto extends createZodDto(sendEmailingSchema) {}
