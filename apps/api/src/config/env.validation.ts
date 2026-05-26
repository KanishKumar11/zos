// Validates and types process.env at boot. Throws fast on missing/invalid env.
import { z } from 'zod';

// Treats empty-string env vars the same as missing ones so `.default()` kicks in.
const coerceInt = (defaultValue: number) =>
  z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().positive(),
  ).default(defaultValue);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: coerceInt(4000),
  APP_URL: z.string().url(),
  WEB_URL: z.string().url(),

  MONGO_URI: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_INVITE_SECRET: z.string().min(16),
  JWT_INVITE_EXPIRES_IN: z.string().default('7d'),
  JWT_RESET_SECRET: z.string().min(16),
  JWT_RESET_EXPIRES_IN: z.string().default('1h'),

  ENCRYPTION_KEY: z.string().min(32),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: coerceInt(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  S3_PRESIGN_TTL_SECONDS: coerceInt(900),

  SEED_OWNER_EMAIL: z.string().email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
  SEED_OWNER_NAME: z.string().min(1).optional(),

  THROTTLE_TTL_SECONDS: coerceInt(60),
  THROTTLE_LIMIT: coerceInt(100),
  AUTH_THROTTLE_LIMIT: coerceInt(20),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
