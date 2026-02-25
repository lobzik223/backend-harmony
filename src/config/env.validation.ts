import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('/api'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

    CORS_ORIGIN: z.string().default('*'),
    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(30),

    APP_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(8).optional()),

    DATABASE_URL: z.string().min(1),

    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

    FIREBASE_PROJECT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    FIREBASE_CLIENT_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    FIREBASE_PRIVATE_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),

    YOOKASSA_SHOP_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    YOOKASSA_SECRET_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    SITE_API_KEY: z.string().min(16).default('harmony-site-secret-key-change-me'), // production: set your own 24+ chars
    SUBSCRIPTION_SITE_URL: z.string().url().default('https://harmony.app/premium'),

    APPLE_SHARED_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    ANDROID_PACKAGE_NAME: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),

    SUPPORT_TELEGRAM_URL: z.string().url().default('https://t.me/harmony_support'),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production') {
      if (!v.APP_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_KEY'],
          message: 'APP_KEY is required in production (min 32 chars). Use for X-Harmony-App-Key from app.',
        });
      } else if (v.APP_KEY.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_KEY'],
          message: 'APP_KEY must be at least 32 characters in production',
        });
      }
      if (v.SITE_API_KEY === 'harmony-site-secret-key-change-me') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SITE_API_KEY'],
          message: 'Change SITE_API_KEY in production (min 24 chars)',
        });
      }
      if (v.CORS_ORIGIN === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'Set CORS_ORIGIN to your app origin(s) in production, e.g. https://yourapp.com or comma-separated list',
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
