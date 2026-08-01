/**
 * Wire shapes for hydration tracking.
 *
 * Every volume crossing the API is in MILLILITRES, the same rule the weight
 * vertical applies to kilograms: fl oz and litres are display preferences
 * converted once at render. Converting server-side as well would round twice
 * and drift the day total away from the entries that add up to it.
 */

/** One drink. Append-only — an undo tombstones the row, never edits the total. */
export type WaterEntryDto = {
  id: string;
  /** Client-local calendar day, YYYY-MM-DD. */
  entryDate: string;
  volumeMl: number;
  /** ISO-8601 with offset; orders entries within a day. */
  loggedAt: string;
  /** "manual" today; an importer name if one ever lands. */
  source: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type WaterGoalDto = {
  dailyGoalMl: number;
  /**
   * False when the user has never set one and this is the bodyweight-derived
   * default. The UI says so rather than presenting a guess as a decision.
   */
  isCustom: boolean;
  updatedAt: string | null;
};

/** A day's rollup, for the 7-day strip. */
export type WaterDayDto = {
  date: string;
  totalMl: number;
};

/**
 * The tile + detail payload.
 *
 * `days` covers a trailing window ending on the caller's local today, and a day
 * with nothing logged is present with `totalMl: 0` — the total genuinely is
 * zero for a day that has ended. That is different from the day being absent,
 * which the client reads as "outside the window", not "drank nothing".
 */
export type WaterSummaryResponse = {
  /** The caller's local today, per users.timezone. */
  date: string;
  totalMl: number;
  goal: WaterGoalDto;
  /** Today's drinks, newest first. */
  entries: WaterEntryDto[];
  days: WaterDayDto[];
  /** Consecutive days ending today that met the goal. */
  streakDays: number;
};

export type WaterEntryResponse = { entry: WaterEntryDto };

export type WaterEntriesResponse = {
  entries: WaterEntryDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type WaterGoalResponse = { goal: WaterGoalDto };

/** Millilitres per litre — for display formatting on both sides. */
export const ML_PER_L = 1000;

/**
 * Bounds mirroring the water_goals CHECK constraint.
 */
export const WATER_GOAL_MIN_ML = 500;
export const WATER_GOAL_MAX_ML = 10_000;

/** Bounds mirroring the water_entries CHECK constraint. */
export const WATER_ENTRY_MIN_ML = 1;
export const WATER_ENTRY_MAX_ML = 5000;

/**
 * Millilitres per kilogram of bodyweight — the common ~35 ml/kg heuristic.
 * Deliberately a starting point, not a prescription.
 */
const ML_PER_KG_BODYWEIGHT = 35;

/** Fallback when there is no bodyweight to derive from yet. */
export const WATER_GOAL_FALLBACK_ML = 2500;

/**
 * The goal for someone who has never set one.
 *
 * Derived rather than stored, so a new account gets a real target with no
 * setup step and `water_goals` only ever holds an explicit override. Lives here
 * so the API and the app cannot disagree about what an unset goal means — the
 * same reason CALORIE_BAND is in summaries.ts.
 *
 * Rounded to the nearest 100 ml: the input is a rule of thumb, and a target of
 * "2 447 ml" claims a precision the heuristic does not have.
 */
export function defaultWaterGoalMl(weightKg: number | null): number {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return WATER_GOAL_FALLBACK_ML;
  }
  const raw = Math.round((weightKg * ML_PER_KG_BODYWEIGHT) / 100) * 100;
  return Math.min(WATER_GOAL_MAX_ML, Math.max(WATER_GOAL_MIN_ML, raw));
}
