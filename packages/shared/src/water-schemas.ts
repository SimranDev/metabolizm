/**
 * Water request validation shared by apps/api and the mobile client.
 *
 * Volumes are integers because the column is: a fractional millilitre is not a
 * measurement anyone takes, and accepting one only creates a value the database
 * would silently truncate.
 */

import { z } from "zod";

import { loggableEntryDateSchema } from "./diary-schemas";
import {
  WATER_ENTRY_MAX_ML,
  WATER_ENTRY_MIN_ML,
  WATER_GOAL_MAX_ML,
  WATER_GOAL_MIN_ML,
} from "./water";

const volumeMl = z
  .number()
  .int()
  .min(WATER_ENTRY_MIN_ML)
  .max(WATER_ENTRY_MAX_ML);

/**
 * `entryDate` uses the loggable (bounded) schema, not the read-side one: a
 * drink dated 2099 would sit at the top of every "latest day" read forever.
 * Same reasoning as diary entries.
 */
export const createWaterEntrySchema = z.object({
  /** Client-generated UUIDv7; re-posting a queued log is idempotent. */
  id: z.uuid().optional(),
  entryDate: loggableEntryDateSchema,
  volumeMl,
  /** Captured client-side; ISO-8601 with offset. */
  loggedAt: z.iso.datetime({ offset: true }),
  source: z.string().trim().min(1).max(40).default("manual"),
});

export type CreateWaterEntryInput = z.output<typeof createWaterEntrySchema>;

export const waterEntriesQuerySchema = z.object({
  /** Opaque keyset cursor from a previous page; omit for the newest page. */
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type WaterEntriesQuery = z.output<typeof waterEntriesQuerySchema>;

/** How many trailing days the summary's `days` window covers. */
export const WATER_SUMMARY_MAX_DAYS = 90;

export const waterSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(WATER_SUMMARY_MAX_DAYS).default(7),
});

export type WaterSummaryQuery = z.output<typeof waterSummaryQuerySchema>;

/**
 * Setting a goal is an upsert of the single row, not a versioned insert — see
 * the note on `water_goals` in the schema for why hydration has no history.
 */
export const putWaterGoalSchema = z.object({
  dailyGoalMl: z
    .number()
    .int()
    .min(WATER_GOAL_MIN_ML)
    .max(WATER_GOAL_MAX_ML),
});

export type PutWaterGoalInput = z.output<typeof putWaterGoalSchema>;
