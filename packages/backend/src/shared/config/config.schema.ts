import { z } from 'zod';

export const ConfigSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url(),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  // Resend email provider (optional — emails are no-op when not set)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  // Google AI Studio LLM (optional — GenericAdapter is disabled without it)
  AISTUDIO_API_KEY: z.string().optional(),
  AISTUDIO_MODEL: z.string().optional(),
  // OpenTelemetry — optional, app starts normally without a collector
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('invoice-flow-backend'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export const validateConfig = (): AppConfig => {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      'Invalid environment variables:',
      result.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return result.data;
};
