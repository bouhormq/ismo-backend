export type TransactionalEmail = {
  email: string;
  subject: string;
  messageId: string;
  uuid: string;
  date: string;
  templateId: number;
  from: string;
  tags: string[];
};

export type TransactionalEmailsResponse = {
  count: number;
  transactionalEmails: TransactionalEmail[];
};
