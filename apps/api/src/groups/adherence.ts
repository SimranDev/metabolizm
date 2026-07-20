/**
 * Pure adherence/streak math over daily_summaries rows and their SNAPSHOTTED
 * targets (never live user_targets — that's what keeps past weeks stable when
 * a target changes). Everything here returns booleans, fractions, and day
 * counts; absolute kcal/gram numbers never leave this module's inputs.
 */
import type { GroupAdherenceFlags, GroupShareConfig } from "@metabolizm/shared";

import { addDays } from "./dates";

/** A daily_summaries row as this module needs it. */
export type DaySummaryFacts = {
  entryDate: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsLogged: number;
  mealNames: string[];
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  weightKg: number | null;
};

// Hit/missed thresholds. Calories count within ±10% of target; protein is a
// floor (≥90%); carbs/fat are caps (≤110%).
const CALORIE_BAND = 0.1;
const PROTEIN_FLOOR = 0.9;
const CAP_BAND = 1.1;

/**
 * Booleans-only view of a day vs its snapshotted targets. A check is `null`
 * when that target wasn't set; an unlogged day misses every set target.
 */
export function adherenceFlags(s: DaySummaryFacts | null): GroupAdherenceFlags {
  const logged = s !== null && s.mealsLogged > 0;
  const check = (
    target: number | null | undefined,
    pass: boolean,
  ): boolean | null => (target == null ? null : logged && pass);
  return {
    logged,
    caloriesInRange: check(
      s?.targetKcal,
      s !== null &&
        s.targetKcal !== null &&
        Math.abs(s.energyKcal - s.targetKcal) <= s.targetKcal * CALORIE_BAND,
    ),
    proteinHit: check(
      s?.targetProteinG,
      s !== null &&
        s.targetProteinG !== null &&
        s.proteinG >= s.targetProteinG * PROTEIN_FLOOR,
    ),
    carbsInRange: check(
      s?.targetCarbsG,
      s !== null &&
        s.targetCarbsG !== null &&
        s.carbsG <= s.targetCarbsG * CAP_BAND,
    ),
    fatInRange: check(
      s?.targetFatG,
      s !== null && s.targetFatG !== null && s.fatG <= s.targetFatG * CAP_BAND,
    ),
  };
}

/**
 * 0..1 fraction of the day's set targets that were hit; null when the day has
 * no targets to score against (never logged targets, or no summary row).
 */
export function dayAdherenceScore(s: DaySummaryFacts | null): number | null {
  const flags = adherenceFlags(s);
  const checks = [
    flags.caloriesInRange,
    flags.proteinHit,
    flags.carbsInRange,
    flags.fatInRange,
  ].filter((v): v is boolean => v !== null);
  if (checks.length === 0) return null;
  return checks.filter(Boolean).length / checks.length;
}

/** All set targets hit; null when the day is unscorable. */
export function dayAdherent(s: DaySummaryFacts | null): boolean | null {
  const score = dayAdherenceScore(s);
  return score === null ? null : score === 1;
}

/** One slot of an adherence window: a calendar day and its summary, if any. */
export type WindowDay = { date: string; summary: DaySummaryFacts | null };

/**
 * Consistency over a window, 0–100. A day the member didn't log scores 0
 * rather than dropping out of the average — otherwise logging a single
 * mediocre day would outrank logging all seven well.
 *
 * Only days up to `asOf` (the member's own current local date) count, so the
 * days remaining in the current week aren't charged as misses. Returns null
 * when no elapsed day was scorable at all — the member has no targets, so
 * there is nothing to be adherent to.
 */
export function windowAdherencePct(
  days: WindowDay[],
  asOf: string,
): number | null {
  const elapsed = days.filter((d) => d.date <= asOf);
  const scores = elapsed.map((d) => dayAdherenceScore(d.summary));
  if (!scores.some((s) => s !== null)) return null;
  const total = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
  return Math.round((total / elapsed.length) * 100);
}

/**
 * Current logging streak: consecutive logged days ending today — or
 * yesterday, so an unfinished today doesn't read as a broken streak.
 */
export function computeStreak(
  loggedDates: ReadonlySet<string>,
  today: string,
): number {
  let day = loggedDates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (loggedDates.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Whether the member exposes any adherence-derived data to the group. */
export function sharesAdherence(config: GroupShareConfig): boolean {
  return config.adherenceOnly || config.calories || config.macros;
}

export type AdherenceBucket = "on-track" | "slipping" | "off-track";

/**
 * Coach-roster bucket. Falls back to logging consistency when the client
 * shares no adherence data (or has no targets).
 */
export function adherenceBucket(
  adherencePct: number | null,
  daysLogged: number,
  windowDays: number,
): AdherenceBucket {
  const pct = adherencePct ?? Math.round((daysLogged / windowDays) * 100);
  if (pct >= 80) return "on-track";
  if (pct >= 50) return "slipping";
  return "off-track";
}
