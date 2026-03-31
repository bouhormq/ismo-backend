import { z } from 'zod';

export function transformObject<T extends object | object[], U extends object>(
  input: T,
  transformer: (data: T extends Array<infer TArr> ? TArr : T) => U,
): T extends Array<unknown> ? U[] : U {
  if (Array.isArray(input)) {
    return input.map(
      (val) => z.any().transform(transformer).safeParse(val).data,
    ) as T extends unknown[] ? U[] : U;
  }

  return z.any().transform(transformer).safeParse(input)
    .data as T extends unknown[] ? U[] : U;
}

export const getS3Url = (photo: string) => {
  if (photo.includes('http')) {
    return photo;
  }
  return `${process.env.S3_BASE_URL}/${photo}`;
};

export const arrayOfStringsToNumber = (
  value?: {
    value?: string;
    label?: string;
  }[],
) => {
  return value && value.length > 0
    ? value?.map((type) => parseInt(type.value))
    : undefined;
};

export const generateOtp = (): string => {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
};

export const isExpiredByMinutes = (date: Date, minutes: number): boolean => {
  if (!date) return false;
  const currentDate = new Date();
  const diff = Math.abs(currentDate.getTime() - date.getTime());

  return Math.floor(diff / 60000) > minutes;
};

export const isImage = (url: string) => {
  return /\.(jpeg|jpg|gif|png|webp)$/.test(url);
};
