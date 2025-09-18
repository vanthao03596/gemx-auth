import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_PRIVATE_KEY_PEM: z.string(),
  JWT_PUBLIC_KEY_PEM: z.string(),
  RATE_LIMIT_WINDOW: z.string().default('15m'),
  RATE_LIMIT_MAX: z.string().default('5').transform(Number),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : undefined)),

  // OAuth configuration
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url('Google Redirect URI must be a valid URL'),
  TWITTER_CLIENT_ID: z.string().min(1, 'Twitter Client ID is required'),
  TWITTER_CLIENT_SECRET: z.string().min(1, 'Twitter Client Secret is required'),
  TWITTER_REDIRECT_URI: z
    .string()
    .url('Twitter Redirect URI must be a valid URL'),
  FRONTEND_DEFAULT_URL: z
    .string()
    .url('Frontend Default URL must be a valid URL')
    .default('http://localhost:3000'),

  SMTP_HOST: z
    .string()
    .min(1, 'SMTP Host is required')
    .default('smtp.mailgun.org'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // SIWE configuration
  RPC_URL: z.string().url('RPC URL must be a valid URL'),
  SIWE_DOMAINS: z
    .string()
    .min(1, 'SIWE domains are required')
    .transform((val) => val.split(',')),
  CHAIN_ID: z.string().default('1').transform(Number),

  // Service-to-service authentication for wallet system
  SERVICE_API_KEYS: z
    .string()
    .min(1, 'Service API keys JSON is required')
    .transform((val) => {
      try {
        const parsed = JSON.parse(val);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('SERVICE_API_KEYS must be a valid JSON object');
        }
        return parsed;
      } catch (error) {
        throw new Error('SERVICE_API_KEYS must be valid JSON');
      }
    }),
  ALLOWED_SERVICES: z
    .string()
    .min(1, 'Allowed services JSON array is required')
    .transform((val) => {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) {
          throw new Error('ALLOWED_SERVICES must be a valid JSON array');
        }
        return parsed;
      } catch (error) {
        throw new Error('ALLOWED_SERVICES must be valid JSON array');
      }
    }),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((err) => err.path.join('.'))
        .join(', ');
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}`
      );
    }
    throw error;
  }
};

export const env = parseEnv();
