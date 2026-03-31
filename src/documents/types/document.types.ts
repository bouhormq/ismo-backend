import { Document } from '@prisma/client';

export type DocumentWithStatus = Partial<Document> & {
  status?: string;
};
