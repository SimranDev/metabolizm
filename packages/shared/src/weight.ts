/**
 * Wire shapes for the weight vertical. Every weight crossing the API is in
 * KILOGRAMS — `unit` on a response says how the client should render it, not
 * what the numbers are in. Converting server-side for display would round
 * twice and show a chart that drifts from the history list.
 */

import type { WeightUnit } from "./health";

export type WeightEntryDto = {
  id: string;
  /** Client-local calendar day, YYYY-MM-DD. */
  entryDate: string;
  weightKg: number;
  /** ISO-8601 with offset; orders entries within a day. */
  loggedAt: string;
  note: string | null;
  /** "manual" today; an importer name once Health Connect / HealthKit land. */
  source: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type WeightGoalDto = {
  id: string;
  effectiveFrom: string;
  targetWeightKg: number;
  /** Snapshotted when the goal was set — anchors progressPct and sinceStart. */
  startingWeightKg: number;
  /** User-chosen deadline, distinct from the trend-projected date. */
  targetDate: string | null;
  createdAt: string;
};

/** One plotted point. `d` is the BUCKET START date when bucket !== "day". */
export type WeightSeriesPoint = { d: string; kg: number };

export type WeightRange = "1W" | "1M" | "3M" | "1Y" | "ALL";
export type WeightBucket = "day" | "week" | "month";

/**
 * Every field is nullable because a brand-new user has no weigh-ins, and a
 * fabricated zero would read as a real measurement. The client renders a
 * designed empty state per null, never a 0.
 */
export type WeightStats = {
  currentKg: number | null;
  /** Change across the requested range. */
  changeKg: number | null;
  avg7Kg: number | null;
  avg30Kg: number | null;
  /** Signed change from the goal's starting weight; null without a goal. */
  sinceStartKg: number | null;
  /** 0–100, clamped. Null without a goal, or when start === target. */
  progressPct: number | null;
  /** Least-squares slope of the EMA over the last 14 days, kg per week. */
  trendKgPerWeek: number | null;
  /** Null whenever the trend can't honestly support a date — never faked. */
  projectedGoalDate: string | null;
  streakDays: number;
  allTimeLowKg: number | null;
};

export type WeightMilestoneKind = "threshold" | "all-time-low" | "goal-reached";

export type WeightMilestone = {
  kind: WeightMilestoneKind;
  /** The crossed value in kg; the client formats it in the display unit. */
  valueKg: number;
  date: string;
};

export type WeightSeriesResponse = {
  /** The user's display preference — the numbers above are always kg. */
  unit: WeightUnit;
  range: WeightRange;
  /** Which bucket the points were aggregated into, so the axis labels match. */
  bucket: WeightBucket;
  points: WeightSeriesPoint[];
  goal: WeightGoalDto | null;
  stats: WeightStats;
  milestones: WeightMilestone[];
};

/** The Vitals tile payload: everything but the plotted series. */
export type WeightSummaryResponse = {
  unit: WeightUnit;
  goal: WeightGoalDto | null;
  stats: WeightStats;
  /** Last 30 days, daily — enough for the tile's sparkline. */
  sparkline: WeightSeriesPoint[];
};

export type WeightEntryResponse = { entry: WeightEntryDto };

export type WeightEntriesResponse = {
  entries: WeightEntryDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type WeightGoalResponse = { goal: WeightGoalDto | null };
