import { z } from 'zod';

const EnvSchema = z.object({
  APP_MODE: z.enum(['DEMO_SIMULATION', 'PRODUCTION']).default('DEMO_SIMULATION'),
  EXECUTION_MODE: z.enum(['DEMO_SIMULATION', 'RAZORPAY_TEST_MODE']).default('DEMO_SIMULATION'),
  AI_PROVIDER: z.enum(['MOCK_SIMULATION', 'ANTHROPIC']).default('MOCK_SIMULATION'),
  DATABASE_PROVIDER: z.enum(['IN_MEMORY', 'SUPABASE']).default('IN_MEMORY'),
  ANTHROPIC_API_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function parseEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    return EnvSchema.parse({});
  }
  return parsed.data;
}

export const env = parseEnv();
