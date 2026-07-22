/**
 * The daily read model on the wire — one row per (user, local calendar day),
 * projected from diary entries by SummariesService and read back by the Log
 * tab's day switcher.
 *
 * These are DERIVED values, never authored ones. A client holding the diary
 * entries for a day can compute the same numbers itself and should prefer its
 * own copy — that is what lets the day strip paint from disk with no request,
 * and it is why there is no merge/conflict rule here. The server copy exists
 * for the days a device no longer keeps.
 *
 * A day with no row is "nothing logged", NOT a zero day. Consumers must render
 * those two differently, for the same reason the groups UI never renders a
 * withheld value as a blank.
 */

/** One (user, day) rollup. Mirrors the columns of `daily_summaries`. */
export type DaySummaryDto = {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Distinct meal slots with at least one entry; 0 means the day is unlogged. */
  mealsLogged: number;
  mealNames: string[];
  /**
   * The targets in force FOR this day, snapshotted when it was last recomputed
   * — not today's. Null when the account had no targets yet, which makes the
   * day unscorable rather than a miss.
   */
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  weightKg: number | null;
};

export type SummaryDaysResponse = {
  /**
   * The caller's own current local date, per `users.timezone`. Authoritative:
   * every server-side day pivots on that column, so a client that disagrees
   * would highlight one day in the strip while the streak counted another.
   */
  today: string;
  /** Ascending, sparse — only days that have a row. */
  days: DaySummaryDto[];
  /**
   * Consecutive logged days ending today, or yesterday so an unfinished today
   * doesn't read as a broken streak. Computed over all history, not just the
   * requested range, and never counts a future planned day.
   */
  loggingStreak: number;
};

/**
 * Thresholds for scoring a day against its snapshotted targets: calories count
 * within ±10% of target, protein is a floor, carbs/fat are caps.
 *
 * Shared so the server's group adherence (apps/api/src/groups/adherence.ts) and
 * the client's day colouring (apps/mobile/src/lib/diary/day-status.ts) can
 * never drift into disagreeing about whether the same day was on target.
 */
export const CALORIE_BAND = 0.1;
export const PROTEIN_FLOOR = 0.9;
export const CAP_BAND = 1.1;
