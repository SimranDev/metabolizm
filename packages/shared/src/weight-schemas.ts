/**
 * Weight request validation shared by apps/api and the mobile client.
 *
 * Note what is NOT validated here: the plausibility range (20–500 kg). A
 * request may send pounds, and 44.1 lb converts to 20.0035 kg which rounds to
 * exactly 20.00 — outside the DB's `> 20` check. The bound therefore has to be
 * applied to the CONVERTED, ROUNDED kilogram value in the service, not to the
 * raw input here. See isPlausibleKg in apps/api/src/weight/compute.ts.
 */

import { z } from "zod";

import { entryDateSchema } from "./diary-schemas";
import type { WeightUnit } from "./health";
import type { WeightBucket, WeightRange } from "./weight";

/** Mirrors the weight_entries / user_weight_goals CHECK constraints. */
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 500;

// The tuple must stay in sync with WeightUnit (health.ts) and the weight_unit
// pg enum; `satisfies` fails the build if a member drifts. The type is NOT
// re-exported — index.ts is a flat `export *`, so redeclaring WeightUnit here
// would be a duplicate export.
export const weightUnitSchema = z.enum([
  "kg",
  "lb",
  "st",
]) satisfies z.ZodType<WeightUnit>;

export const weightRangeSchema = z.enum([
  "1W",
  "1M",
  "3M",
  "1Y",
  "ALL",
]) satisfies z.ZodType<WeightRange>;

export const weightBucketSchema = z.enum([
  "day",
  "week",
  "month",
]) satisfies z.ZodType<WeightBucket>;

// Loose outer bounds only — 2000 covers 500 kg expressed in pounds. The real
// gate runs after conversion.
const rawWeight = z.number().positive().max(2000);

/**
 * A weigh-in accepts either `{ weightKg }` or `{ weight, unit }` — exactly one
 * — so the client can post what the user typed without converting first and
 * rounding differently from the server.
 */
export const createWeightEntrySchema = z
  .object({
    /** Client-generated UUIDv7; re-posting a queued log is idempotent. */
    id: z.uuid().optional(),
    entryDate: entryDateSchema,
    /** Captured client-side; ISO-8601 with offset. */
    loggedAt: z.iso.datetime({ offset: true }),
    note: z.string().trim().max(280).nullable().optional(),
    source: z.string().trim().min(1).max(40).default("manual"),
    weightKg: rawWeight.optional(),
    weight: rawWeight.optional(),
    unit: weightUnitSchema.optional(),
  })
  .refine((v) => (v.weightKg === undefined) !== (v.weight === undefined), {
    message: "Send exactly one of weightKg or weight",
  })
  .refine((v) => v.weight === undefined || v.unit !== undefined, {
    message: "unit is required when sending weight",
  });

export type CreateWeightEntryInput = z.output<typeof createWeightEntrySchema>;

/**
 * Partial patch with NO per-field defaults: a schema defaulting each field
 * would materialize every unmentioned key and silently overwrite what the
 * caller didn't name (the same trap documented for groupSharePatchSchema).
 */
export const patchWeightEntrySchema = z
  .object({
    entryDate: entryDateSchema.optional(),
    loggedAt: z.iso.datetime({ offset: true }).optional(),
    note: z.string().trim().max(280).nullable().optional(),
    weightKg: rawWeight.optional(),
    weight: rawWeight.optional(),
    unit: weightUnitSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Patch must change at least one field",
  })
  .refine((v) => v.weightKg === undefined || v.weight === undefined, {
    message: "Send at most one of weightKg or weight",
  })
  .refine((v) => v.weight === undefined || v.unit !== undefined, {
    message: "unit is required when sending weight",
  });

export type PatchWeightEntryInput = z.output<typeof patchWeightEntrySchema>;

export const weightEntriesQuerySchema = z.object({
  /** Opaque keyset cursor from a previous page; omit for the newest page. */
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type WeightEntriesQuery = z.output<typeof weightEntriesQuerySchema>;

export const weightSeriesQuerySchema = z.object({
  range: weightRangeSchema.default("3M"),
});

export type WeightSeriesQuery = z.output<typeof weightSeriesQuerySchema>;

/**
 * Setting a goal INSERTS a new versioned row (mirroring user_targets); it
 * never updates the previous one, so past progress keeps its original anchor.
 * `startingWeightKg` is snapshotted at write time — omit it and the server
 * uses the latest weigh-in, or 400s when there isn't one.
 */
export const putWeightGoalSchema = z
  .object({
    targetWeightKg: rawWeight.optional(),
    targetWeight: rawWeight.optional(),
    unit: weightUnitSchema.optional(),
    startingWeightKg: rawWeight.optional(),
    targetDate: entryDateSchema.nullable().optional(),
    /** Defaults to the user's local today. */
    effectiveFrom: entryDateSchema.optional(),
  })
  .refine(
    (v) => (v.targetWeightKg === undefined) !== (v.targetWeight === undefined),
    { message: "Send exactly one of targetWeightKg or targetWeight" },
  )
  .refine((v) => v.targetWeight === undefined || v.unit !== undefined, {
    message: "unit is required when sending targetWeight",
  });

export type PutWeightGoalInput = z.output<typeof putWeightGoalSchema>;
