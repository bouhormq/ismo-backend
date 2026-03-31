export const monthNames = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const formatDateUtils = {
  getStartOfDay: (date: Date | string): string => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  getEndOfDay: (date: Date | string): string => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  getStartOfDayISO: (date: Date | string): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  },

  getEndOfDayISO: (date: Date | string): string => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  },
};
