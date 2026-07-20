/**
 * Account preference writes. This is the only path that sets users.timezone,
 * which every server-side "today" pivots on — a stale value silently shifts
 * streaks and entry dates by a day, so the mobile client pushes the device
 * timezone on launch.
 */

import { z } from "zod";

import { weightUnitSchema } from "./weight-schemas";

/**
 * Validated by construction rather than against a list: Intl.supportedValuesOf
 * isn't guaranteed on Hermes, and this schema is bundled into the app. Callers
 * are still safe if a bad value slips through — localDateFor falls back to UTC
 * rather than failing a whole group read.
 */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown IANA timezone");

// Partial patch with NO per-field defaults — see patchWeightEntrySchema.
export const updateMeSchema = z
  .object({
    timezone: timezoneSchema.optional(),
    weightUnit: weightUnitSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Patch must change at least one field",
  });

export type UpdateMeInput = z.output<typeof updateMeSchema>;
