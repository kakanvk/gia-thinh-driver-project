import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') dotenv.config();

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    MONGODB_URL: z.string().min(1),
    APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_MIN: z.coerce.number().int().positive().default(15),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGINS: csv,
    COOKIE_DOMAIN: z.string().optional(),
    STORAGE_DRIVER: z.enum(['local', 'gcs']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    GCS_BUCKET: z.string().optional(),
    PUBLIC_MEDIA_BASE_URL: z.url().optional(),
    SEED_ADMIN_USERNAME: z.string().optional(),
    SEED_ADMIN_PHONE: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === 'gcs' && !value.GCS_BUCKET) {
      ctx.addIssue({ code: 'custom', path: ['GCS_BUCKET'], message: 'Bắt buộc khi STORAGE_DRIVER=gcs' });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Biến môi trường không hợp lệ:\n${lines.join('\n')}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
