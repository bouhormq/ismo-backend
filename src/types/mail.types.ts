type EmailObject = {
  email: string;
  name: string;
};

export type SendMailArgs = {
  sender: EmailObject;
  to: EmailObject[];
  replyTo?: EmailObject;
  subject?: string;
  templateId?: number;
  htmlContent?: string;
  bcc?: Omit<EmailObject, 'name'>[];
  cc?: Omit<EmailObject, 'name'>[];
  params?: Record<string, string | string[] | object[]>;
  attachment?: { url: string; name: string }[];
};

export type CreateContactAttributes = {
  INDUSTRIE: string;
  CATEGORIE: string;
  CONTACT_ORIGIN: string;
  SMS: string;
  WHATSAPP: string;
  NOM: string; // we need to have the `last name ` // Done
  PRENOM: string; // First name - functionality // Done
  POTENTIEL_DE_LA_SOCIETE: string; // potentiels de la societe
  RUBRIQUE: string; // SECTIONS <- RUBRIQUE
  PAYS: string; // PAYS
  PRODUIT_UTILISE: string; // article utilise
  PRODUIT_DESIRE: string; //  article desire
  NOM_DE_LA_SOCIETE: string; // nom de societe
};

export type CreateContactBrevoArgs = {
  email: string;
  attributes: CreateContactAttributes;
};

export type GetEmailEventReportOptions = {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  days?: number;
  email?: string;
  event?:
    | 'bounces'
    | 'hardBounces'
    | 'softBounces'
    | 'delivered'
    | 'spam'
    | 'requests'
    | 'opened'
    | 'clicks'
    | 'invalid'
    | 'deferred'
    | 'blocked'
    | 'unsubscribed'
    | 'error';
  tags?: string;
  messageId?: string;
  templateId?: number;
};
