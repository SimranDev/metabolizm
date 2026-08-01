/**
 * Fasting request validation shared by apps/api and the mobile client.
 */

import { z } from "zod";

import { FASTING_MAX_HOURS, FASTING_MIN_HOURS } from "./fasting";

/**
 * Starting a fast.
 *
 * `startedAt` is client-supplied and optional so a user can backdate ("I
 * actually stopped eating at 8pm") without the server guessing. The server
 * bounds it: a fast that began in the future is a clock bug, and one that began
 * a week ago is a forgotten timer rather than a fast.
 */
export const startFastSchema = z.object({
  /** Client-generated UUIDv7; re-posting a queued start is idempotent. */
  id: z.uuid().optional(),
  startedAt: z.iso.datetime({ offset: true }).optional(),
  targetHours: z
    .number()
    .int()
    .min(FASTING_MIN_HOURS)
    .max(FASTING_MAX_HOURS),
  protocol: z.string().trim().min(1).max(40).default("custom"),
  note: z.string().trim().max(280).nullable().optional(),
});

export type StartFastInput = z.output<typeof startFastSchema>;

/**
 * Ending (or editing) a fast. No per-field defaults — a schema defaulting each
 * key would materialize every unmentioned field and silently overwrite what the
 * caller didn't name, the trap documented for groupSharePatchSchema.
 */
export const endFastSchema = z
  .object({
    endedAt: z.iso.datetime({ offset: true }).optional(),
    targetHours: z
      .number()
      .int()
      .min(FASTING_MIN_HOURS)
      .max(FASTING_MAX_HOURS)
      .optional(),
    note: z.string().trim().max(280).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Patch must change at least one field",
  });

export type EndFastInput = z.output<typeof endFastSchema>;

export const fastingSessionsQuerySchema = z.object({
  /** Opaque keyset cursor from a previous page; omit for the newest page. */
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

export type FastingSessionsQuery = z.output<typeof fastingSessionsQuerySchema>;

/**
 * How far back a fast may be backdated when starting one.
 *
 * Beyond this it is a timer someone forgot to stop days ago, and accepting it
 * would put a 200-hour "fast" at the top of their history forever — the same
 * reasoning that bounds diary entry dates.
 */
export const FAST_MAX_BACKDATE_HOURS = 48;
