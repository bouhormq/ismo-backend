import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';
import { COUNTRIES_PAIR } from '../utils/cities.constants';

export const getCitiesSchema = z.strictObject({
  country: z.nativeEnum(COUNTRIES_PAIR),
  city: z.string().optional(),
});

export class GetCitiesSchema extends createZodDto(getCitiesSchema) {}
