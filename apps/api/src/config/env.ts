import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Social providers are optional: without them the server boots and only
  // email/password works (each provider is enabled when its id is set).
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Fail-fast env validation for ConfigModule.forRoot({ validate }). */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Environment validation failed:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
