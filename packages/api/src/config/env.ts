import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
// Also try local .env
dotenv.config();

const KNOWN_WEAK_SECRETS = [
  'dev-jwt-secret-change-in-production',
  'dev-jwt-refresh-secret-change-in-production',
  'secret',
  'changeme',
  'password',
];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/scheduler'),

  // JWT secrets — fallback is safe for local dev; production must set proper values
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('dev-jwt-secret-change-in-production-xxxxx'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .default('dev-jwt-refresh-secret-change-in-production-xxxxx'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Accept a comma-separated list of origins so Render env var can be one URL,
  // local dev can add others without changing code.
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(200),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  FRONTEND_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

// Guard: reject known-weak secrets in production
if (data.NODE_ENV === 'production') {
  if (KNOWN_WEAK_SECRETS.includes(data.JWT_SECRET)) {
    console.error('❌ FATAL: JWT_SECRET is a known-weak default. Set a cryptographically random secret in production.');
    process.exit(1);
  }
  if (KNOWN_WEAK_SECRETS.includes(data.JWT_REFRESH_SECRET)) {
    console.error('❌ FATAL: JWT_REFRESH_SECRET is a known-weak default. Set a cryptographically random secret in production.');
    process.exit(1);
  }
}

export const env = data;
export type Env = z.infer<typeof envSchema>;
