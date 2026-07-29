import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /**
   * STOPGAP, NOT AN AUTHORIZATION MODEL. This tool has no auth at all — it
   * binds to loopback and is never deployed. This uuid is only what gets
   * stamped into food_reviews.reviewer_id so a decision has *an* author in the
   * audit trail. It authorizes nothing and checks nothing: anyone who can
   * reach :4000 can approve anything, with or without this set. If review ever
   * moves somewhere reachable, this must be replaced by real accounts before
   * that happens, not after.
   */
  ADMIN_REVIEWER_ID: z.uuid().optional(),
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
