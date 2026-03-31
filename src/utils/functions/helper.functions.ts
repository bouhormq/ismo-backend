import { ContactWithStatus } from 'src/contacts/types/contact.types';
import { DocumentWithStatus } from 'src/documents/types/document.types';

export function slugify(str: string) {
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function _formatSelectInput(
  data: {
    value?: string | number;
    isNew?: boolean;
    deleted?: boolean;
  }[],
) {
  const toBeDeleted: number[] = [];
  const toBeAdded: string[] = [];

  data.forEach(({ value, isNew, deleted }) => {
    if (deleted && typeof value === 'number') toBeDeleted.push(value);
    if (isNew && typeof value === 'string') toBeAdded.push(value);
  });

  return {
    toBeDeleted,
    toBeAdded,
  };
}

export function formatDocuments(data: DocumentWithStatus[]) {
  const toBeDeleted: DocumentWithStatus[] = [];
  const toBeAdded: DocumentWithStatus[] = [];
  const toBeUpdated: DocumentWithStatus[] = [];
  data.forEach((doc) => {
    if (doc.status === 'updated') {
      if (doc.id > 0) {
        toBeUpdated.push(doc);
      } else if (doc.id < 0) {
        toBeAdded.push(doc);
      }
    } else if (doc.status === 'new') {
      toBeAdded.push(doc);
    } else if (doc.status === 'deleted' && doc.id > 0) {
      toBeDeleted.push(doc);
    }
  });

  return { toBeDeleted, toBeAdded, toBeUpdated };
}

export function formatContacts(data: ContactWithStatus[]) {
  const toBeDeleted: ContactWithStatus[] = [];
  const toBeAdded: ContactWithStatus[] = [];
  const toBeUpdated: ContactWithStatus[] = [];
  data.forEach((contact) => {
    if (contact.status === 'updated') {
      if (contact.id > 0) {
        toBeUpdated.push(contact);
      } else if (contact.id < 0) {
        toBeAdded.push(contact);
      }
    } else if (contact.status === 'new') {
      toBeAdded.push(contact);
    } else if (contact.status === 'deleted' && contact.id > 0) {
      toBeDeleted.push(contact);
    }
  });

  return { toBeDeleted, toBeAdded, toBeUpdated };
}
