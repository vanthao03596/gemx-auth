import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_PRIVATE_KEY_PEM: z.string(),
  JWT_PUBLIC_KEY_PEM: z.string(),
  RATE_LIMIT_WINDOW: z.string().default('15m'),
  RATE_LIMIT_MAX: z.string().default('5').transform(Number),
  CORS_ORIGINS: z.string().optional().transform(val => val ? val.split(',') : undefined),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(err => err.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
};

export const env = parseEnv();