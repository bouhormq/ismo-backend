import { Injectable, type ValidationPipeOptions } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const GLOBAL_VALIDATION_PIPE_CONFIG = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transform: true,
} satisfies ValidationPipeOptions;

export const CORS_CONFIG = {
  credentials: true,
  origin: JSON.parse(process.env.ALLOWED_ORIGINS || '[]'),
  exposedHeaders: ['Set-Cookie', 'Content-Disposition', 'Content-Type'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'responseType',
    'Sentry-Trace',
    'Baggage',
  ],
} satisfies CorsOptions;

@Injectable()
export class S3Config {
  public accessKeyId = process.env.S3_ACCESS_KEY_ID;
  public secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  public region = process.env.S3_REGION;
  public signatureVersion = process.env.S3_SIGNATURE_VERSION;
  public bucket = process.env.S3_BUCKET;
}
