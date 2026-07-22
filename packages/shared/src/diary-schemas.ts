/**
 * Diary request validation shared by apps/api and the mobile sync client.
 * Unlike the catalog, macro/nutrient values here are the CONSUMED amounts for
 * the logged quantity, never per 100 base units.
 */
import { z } from "zod";

import { nutrientMapSchema } from "./nutrients";

/** Client-local calendar day (the diary store's todayKey()), YYYY-MM-DD. */
export const entryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const mealIdSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

/** How far ahead a diary entry may be dated — the "plan a future day" window. */
export const DIARY_MAX_FUTURE_DAYS = 30;

/**
 * Server-side slop on top of DIARY_MAX_FUTURE_DAYS. The bound below compares
 * against UTC today, while the client checks against the user's own local
 * today, which can sit ~14h either side of it — so a legitimate day-30 log at
 * UTC+14 must not 400. Two days covers the whole spread with room to spare.
 */
const FUTURE_SLOP_DAYS = 2;

/** Nothing sensible predates the app; this only catches a garbage date. */
const PAST_LIMIT_DAYS = 3650;

/** UTC calendar day `days` from now. ISO dates compare lexicographically. */
const utcDayFromNow = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * An entry date that may actually be WRITTEN, as opposed to merely read.
 *
 * Reads stay on the unbounded `entryDateSchema`: a history query legitimately
 * spans years. Writes are bounded because an entry dated 2099 is never a real
 * log, and one bad row would sit at the top of every `max(entry_date)` and
 * planned-day read forever.
 */
export const loggableEntryDateSchema = entryDateSchema
  .refine((d) => d <= utcDayFromNow(DIARY_MAX_FUTURE_DAYS + FUTURE_SLOP_DAYS), {
    message: `Entry date must be at most ${DIARY_MAX_FUTURE_DAYS} days ahead`,
  })
  .refine((d) => d >= utcDayFromNow(-PAST_LIMIT_DAYS), {
    message: "Entry date is too far in the past",
  });

// Numeric caps mirror the DB column types (numeric(8,2) / numeric(8,3) /
// numeric(10,3)) so out-of-range values 400 here instead of 500 in Postgres.

export const diaryEntryUpsertSchema = z.object({
  /** Client-generated UUIDv7; pushing the same entry twice is an idempotent upsert. */
  id: z.uuid(),
  entryDate: loggableEntryDateSchema,
  meal: mealIdSchema,
  foodId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  servingLabel: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(99_999).nullable().optional(),
  unitLabel: z.string().trim().min(1).max(100).nullable().optional(),
  unitAmountInBase: z.number().positive().max(9_999_999).nullable().optional(),
  energyKcal: z.number().min(0).max(999_999),
  proteinG: z.number().min(0).max(999_999),
  carbsG: z.number().min(0).max(999_999),
  fatG: z.number().min(0).max(999_999),
  nutrients: nutrientMapSchema.default({}),
  verified: z.boolean().default(false),
  /** Captured client-side at log time — offline pushes keep true log order. */
  loggedAt: z.iso.datetime({ offset: true }),
});

export type DiaryEntryUpsert = z.output<typeof diaryEntryUpsertSchema>;

// Batched because multi-select add-food logs several foods at once and the
// sync outbox pushes in batches; atomic — one invalid entry fails the request.
export const upsertDiaryEntriesSchema = z.object({
  entries: z.array(diaryEntryUpsertSchema).min(1).max(50),
});

export type UpsertDiaryEntriesInput = z.output<typeof upsertDiaryEntriesSchema>;

export const DIARY_DAYS_MAX_RANGE = 31;

const daySpan = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;

export const diaryDaysQuerySchema = z
  .object({
    from: entryDateSchema,
    to: entryDateSchema,
  })
  .refine((q) => q.from <= q.to, { message: "from must not be after to" })
  .refine((q) => daySpan(q.from, q.to) <= DIARY_DAYS_MAX_RANGE, {
    message: `Range must be at most ${DIARY_DAYS_MAX_RANGE} days`,
  });

export type DiaryDaysQuery = z.output<typeof diaryDaysQuerySchema>;

export const syncDiaryQuerySchema = z.object({
  /** Opaque cursor from a previous pull; omit to pull from the beginning. */
  since: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type SyncDiaryQuery = z.output<typeof syncDiaryQuerySchema>;

export const diaryRecentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type DiaryRecentsQuery = z.output<typeof diaryRecentsQuerySchema>;
