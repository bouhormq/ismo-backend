import { monthNames } from 'src/utils/constants/misc.constants';
import { addMinutes, addMonths, addYears, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function parseDate(dateString: string | undefined): Date | undefined {
  if (dateString) {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

export const getStartOfDayUTC = (dateString) => {
  const date = new Date(dateString);
  date.setDate(date.getDate());
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

export const getEndOfDayUTC = (dateString) => {
  const date = new Date(dateString);
  date.setDate(date.getDate());
  date.setUTCHours(23, 59, 59, 999);
  return date.toISOString();
};

export function formatDateToFrench(date: Date | string) {
  const dateToFormat = new Date(date);

  // example" 2 Julliet 2024

  const month = monthNames[dateToFormat.getMonth()];
  const day = dateToFormat.getDate();
  const year = dateToFormat.getFullYear();

  return `${day} ${month} ${year}`;
}

export const formatDateToYMD = (date: Date): string => {
  const year: number = date.getFullYear();
  const month: string = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed, so add 1
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDayNameInFrench = (date: Date) => {
  const dayName = format(date, 'EEEE', { locale: fr });
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
};

export const formatTimeForInput = (date: Date) => {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
export const calculateDateExpiration = (
  createdAt: Date,
  warrantyConditions: number,
): Date => {
  if (warrantyConditions >= 1) {
    return addYears(createdAt, warrantyConditions);
  } else if (warrantyConditions <= 1 && warrantyConditions > 0) {
    return addMonths(createdAt, warrantyConditions * 12);
  }
};

export const getTime = (date: Date) => {
  return format(addMinutes(date, date.getTimezoneOffset()), 'HH:mm');
};

export const getDateWithoutTZOffset = (input: string, offset?: number) => {
  const date = new Date(input);
  const userTimezoneOffset = offset ?? date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - userTimezoneOffset);
};
