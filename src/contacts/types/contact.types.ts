import { Contact } from '@prisma/client';

export type ContactWithStatus = Partial<Contact> & {
  status?: string;
};
