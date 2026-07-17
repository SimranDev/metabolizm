import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export type Env = z.infer<typeof envSchema>;

/** Fail-fast env validation, mirroring apps/api/src/config/env.ts. */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Environment validation failed:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
