/**
 * Request validation for the daily read model, shared by apps/api and the
 * mobile summaries client.
 */
import { z } from "zod";

import { entryDateSchema } from "./diary-schemas";

/**
 * Deliberately far wider than DIARY_DAYS_MAX_RANGE (31). That cap protects a
 * read of raw ENTRIES, which is hundreds of rows a month; a summary is one
 * ~120-byte row a day, so a year is ~45 KB and the month grid wants ±1 month
 * of prefetch in a single request.
 */
export const SUMMARY_DAYS_MAX_RANGE = 400;

const daySpan = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;

export const summaryDaysQuerySchema = z
  .object({
    from: entryDateSchema,
    to: entryDateSchema,
  })
  .refine((q) => q.from <= q.to, { message: "from must not be after to" })
  .refine((q) => daySpan(q.from, q.to) <= SUMMARY_DAYS_MAX_RANGE, {
    message: `Range must be at most ${SUMMARY_DAYS_MAX_RANGE} days`,
  });

export type SummaryDaysQuery = z.output<typeof summaryDaysQuerySchema>;
