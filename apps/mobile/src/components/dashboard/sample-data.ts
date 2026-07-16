/**
 * TEMPORARY sample data for the dashboard — food logging, health-platform sync
 * (Apple Health / Health Connect), and sleep/heart import don't exist yet.
 * Everything here is shaped like the eventual data sources so cards can swap to
 * real data without changing their props. Deliberately deterministic (no
 * `Math.random`) so the screen is stable across re-renders and reloads.
 */

import type { Macros } from '@metabolizm/shared';

export type MicroSample = {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  /** `goal` = fill it up (fiber); `limit` = stay under it (sodium). */
  kind: 'goal' | 'limit';
};

export type ScoreFactor = { label: string; value: number };

export const SAMPLE = {
  consumed: {
    calories: 1486,
    macros: { proteinG: 118, carbsG: 132, fatG: 48 } satisfies Macros,
  },
  /** Fraction of the day assumed elapsed for the energy balance (~5:15 pm). */
  dayFraction: 0.72,
  activity: {
    steps: 8432,
    stepGoal: 10000,
    activeCalories: 412,
    exerciseMinutes: 38,
    exerciseGoalMinutes: 45,
    distanceKm: 6.2,
  },
  water: { glasses: 5, goalGlasses: 8, mlPerGlass: 250 },
  fasting: { hoursFasted: 14.5, goalHours: 16, lastMeal: '8:14 PM' },
  sleep: { lastNight: '7 h 12 m', qualityPct: 84 },
  heart: { restingBpm: 58, restingDelta: -2, hrvMs: 64, hrvDelta: +6, vo2Max: 44.2 },
  bodyFatPct: 18.4,
  score: {
    total: 82,
    delta: +4,
    factors: [
      { label: 'Nutrition', value: 90 },
      { label: 'Activity', value: 71 },
      { label: 'Sleep', value: 78 },
      { label: 'Recovery', value: 88 },
    ] satisfies ScoreFactor[],
  },
  streakDays: 12,
  /** Calories eaten per day, oldest → today. */
  weekCalories: [1720, 1854, 1691, 2103, 1782, 1655, 1486],
  micros: [
    { label: 'Fiber', consumed: 22, target: 38, unit: 'g', kind: 'goal' },
    { label: 'Sugar', consumed: 31, target: 50, unit: 'g', kind: 'limit' },
    { label: 'Sodium', consumed: 1650, target: 2300, unit: 'mg', kind: 'limit' },
    { label: 'Potassium', consumed: 2900, target: 4700, unit: 'mg', kind: 'goal' },
    { label: 'Calcium', consumed: 640, target: 1000, unit: 'mg', kind: 'goal' },
  ] satisfies MicroSample[],
  insight:
    'You hit your protein target 5 of the last 7 days — and those days line up with your best sleep scores. Front-loading protein at breakfast keeps the streak alive.',
} as const;

/** Fixed day-to-day noise so the sample weight series never jumps on reload. */
const WIGGLE = [0, 0.18, -0.06, 0.12, -0.15, 0.08, -0.02, 0.1, -0.12, 0.05, -0.08, 0.14, -0.04, 0];

/**
 * 14 days of sample weight ending exactly at the user's current weight,
 * drifting ~1.1 kg from the direction opposite their goal (flat when there is
 * no goal weight).
 */
export function sampleWeightSeriesKg(currentKg: number, goalKg?: number): number[] {
  const direction =
    goalKg === undefined || goalKg === currentKg ? 0 : goalKg < currentKg ? 1 : -1;
  const lastIndex = WIGGLE.length - 1;
  return WIGGLE.map((noise, i) => currentKg + direction * 1.1 * (1 - i / lastIndex) + noise);
}
