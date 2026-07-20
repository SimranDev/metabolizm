/**
 * Server-side masking — THE privacy boundary of the groups feature.
 *
 * Every group-facing payload for a member is built here, allowlist-style:
 * fields are ADDED only when that member's share config exposes them, never
 * copied wholesale and stripped. An unshared field is therefore absent from
 * the JSON (not null), and unshared data never reaches serialization.
 *
 * adherenceOnly replaces all nutrition/weight/quantity numerics with
 * server-computed booleans. The only numeric that may still appear for such
 * a member is the logging-streak day count (own toggle; gamification, not
 * nutrition data) plus derived daysLogged/adherencePct/rank in leaderboards.
 *
 * Masking reads the member's CURRENT config at read time — no consent
 * snapshots — so a config change takes effect immediately for all past and
 * future days.
 */
import {
  groupShareConfigSchema,
  SHARE_NOTHING,
  type GroupCommentDto,
  type GroupLeaderboardEntryDto,
  type GroupMemberDayCardDto,
  type GroupReactionDto,
  type GroupRosterClientDto,
  type GroupShareConfig,
  type MaskedDiaryEntryDto,
  type MealId,
} from "@metabolizm/shared";

import {
  adherenceBucket,
  adherenceFlags,
  computeStreak,
  dayAdherent,
  sharesAdherence,
  windowAdherencePct,
  type DaySummaryFacts,
  type WindowDay,
} from "./adherence";
import { addDays } from "./dates";

/**
 * Stored configs are partial jsonb; the schema's all-false defaults mean a
 * missing key — or a malformed blob — can only ever under-share.
 */
export function normalizeShareConfig(raw: unknown): GroupShareConfig {
  const parsed = groupShareConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : SHARE_NOTHING;
}

export type WeightTrendFacts = {
  deltaKg: number | null;
  direction: "up" | "down" | "flat" | null;
};

export type MemberDayFacts = {
  userId: string;
  name: string;
  image: string | null;
  /** The member's own local calendar day the card describes. */
  date: string;
  summary: DaySummaryFacts | null;
  weightTrend: WeightTrendFacts;
  streak: number;
};

export type CardInteractions = {
  comments: GroupCommentDto[];
  reactions: GroupReactionDto[];
};

export function buildMemberDayCard(
  facts: MemberDayFacts,
  rawConfig: unknown,
  interactions: CardInteractions,
): GroupMemberDayCardDto {
  const config = normalizeShareConfig(rawConfig);
  const s = facts.summary;
  const card: GroupMemberDayCardDto = {
    userId: facts.userId,
    name: facts.name,
    image: facts.image,
    date: facts.date,
    shared: config,
    logged: s !== null && s.mealsLogged > 0,
    comments: interactions.comments,
    reactions: interactions.reactions,
  };

  if (config.adherenceOnly) {
    // Booleans only — mealsLogged/deltaKg and every consumed number stay out.
    card.adherence = adherenceFlags(s);
    if (config.mealNames) card.mealNames = s?.mealNames ?? [];
    if (config.weightTrend) {
      card.weightTrend = { direction: facts.weightTrend.direction };
    }
    if (config.streaks) card.streak = facts.streak;
    return card;
  }

  if (config.calories) {
    card.calories = {
      consumedKcal: s?.energyKcal ?? 0,
      targetKcal: s?.targetKcal ?? null,
    };
  }
  if (config.macros) {
    card.macros = {
      proteinG: s?.proteinG ?? 0,
      carbsG: s?.carbsG ?? 0,
      fatG: s?.fatG ?? 0,
      targetProteinG: s?.targetProteinG ?? null,
      targetCarbsG: s?.targetCarbsG ?? null,
      targetFatG: s?.targetFatG ?? null,
    };
  }
  if (config.mealNames) {
    card.mealNames = s?.mealNames ?? [];
    card.mealsLogged = s?.mealsLogged ?? 0;
  }
  if (config.weightTrend) {
    card.weightTrend = {
      direction: facts.weightTrend.direction,
      deltaKg: facts.weightTrend.deltaKg,
    };
  }
  if (config.streaks) card.streak = facts.streak;
  return card;
}

export type DiaryEntryFacts = {
  id: string;
  meal: MealId;
  name: string;
  loggedAt: Date;
  servingLabel: string;
  quantity: number | null;
  unitLabel: string | null;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Diary entries as the group may see them. Returns undefined (no entries at
 * all) unless the member shares mealDetail; per-entry numbers additionally
 * require the matching toggle and are absent entirely under adherenceOnly.
 */
export function maskDiaryEntries(
  rows: DiaryEntryFacts[],
  rawConfig: unknown,
): MaskedDiaryEntryDto[] | undefined {
  const config = normalizeShareConfig(rawConfig);
  if (!config.mealDetail) return undefined;
  return rows.map((row) => {
    const dto: MaskedDiaryEntryDto = {
      id: row.id,
      meal: row.meal,
      name: row.name,
      loggedAt: row.loggedAt.toISOString(),
    };
    if (!config.adherenceOnly) {
      dto.servingLabel = row.servingLabel;
      dto.quantity = row.quantity;
      dto.unitLabel = row.unitLabel;
      if (config.calories) dto.energyKcal = row.energyKcal;
      if (config.macros) {
        dto.proteinG = row.proteinG;
        dto.carbsG = row.carbsG;
        dto.fatG = row.fatG;
      }
    }
    return dto;
  });
}

export type LeaderboardMemberFacts = {
  userId: string;
  name: string;
  image: string | null;
  rawConfig: unknown;
  /** The week's days, oldest first (null summary = nothing logged). */
  days: WindowDay[];
  /** The member's own current local date — days past it don't count yet. */
  asOf: string;
  streak: number;
};

/**
 * Weekly consistency ranking: adherence % (vs snapshotted targets), then
 * days logged, then name — never raw calories or weight, and never a value
 * the member doesn't share (hidden streaks don't influence order either).
 */
export function buildLeaderboardEntries(
  members: LeaderboardMemberFacts[],
): GroupLeaderboardEntryDto[] {
  const scored = members.map((m) => {
    const config = normalizeShareConfig(m.rawConfig);
    return {
      member: m,
      config,
      daysLogged: m.days.filter(
        (d) => d.summary !== null && d.summary.mealsLogged > 0,
      ).length,
      adherencePct: sharesAdherence(config)
        ? windowAdherencePct(m.days, m.asOf)
        : null,
    };
  });
  scored.sort(
    (a, b) =>
      (b.adherencePct ?? -1) - (a.adherencePct ?? -1) ||
      b.daysLogged - a.daysLogged ||
      a.member.name.localeCompare(b.member.name),
  );
  return scored.map((s, i) => {
    const entry: GroupLeaderboardEntryDto = {
      rank: i + 1,
      userId: s.member.userId,
      name: s.member.name,
      image: s.member.image,
      daysLogged: s.daysLogged,
      adherencePct: s.adherencePct,
    };
    if (s.config.streaks) entry.streak = s.member.streak;
    return entry;
  });
}

export const ROSTER_WINDOW_DAYS = 7;

export type RosterClientFacts = {
  userId: string;
  name: string;
  image: string | null;
  rawConfig: unknown;
  /** Trailing window in the client's own timezone, oldest first. */
  dates: string[];
  summariesByDate: ReadonlyMap<string, DaySummaryFacts>;
};

/**
 * Coach-roster row: logged/adherent booleans and an adherence % — the same
 * altitude as adherenceOnly sharing; a coach never sees absolute numbers
 * here regardless of the client's config.
 */
export function buildRosterClient(
  facts: RosterClientFacts,
): GroupRosterClientDto {
  const config = normalizeShareConfig(facts.rawConfig);
  const shares = sharesAdherence(config);
  const window: WindowDay[] = facts.dates.map((date) => ({
    date,
    summary: facts.summariesByDate.get(date) ?? null,
  }));
  const days = window.map(({ date, summary }) => ({
    date,
    logged: summary !== null && summary.mealsLogged > 0,
    adherent: shares ? dayAdherent(summary) : null,
  }));
  const daysLogged = days.filter((d) => d.logged).length;
  // The window already ends at the client's today, so every day has elapsed.
  const asOf = facts.dates[facts.dates.length - 1] ?? "";
  const adherence7dPct = shares ? windowAdherencePct(window, asOf) : null;
  return {
    userId: facts.userId,
    name: facts.name,
    image: facts.image,
    bucket: adherenceBucket(adherence7dPct, daysLogged, facts.dates.length),
    adherence7dPct,
    days,
  };
}

/** Streak-window depth: how far back logged-day sets are loaded. */
export const STREAK_LOOKBACK_DAYS = 60;

/** Only the two columns a streak needs, so callers can pass lightweight rows. */
export type LoggedDayFacts = { entryDate: string; mealsLogged: number };

export function streakFrom(
  summaries: Iterable<LoggedDayFacts>,
  today: string,
): number {
  const logged = new Set<string>();
  for (const s of summaries) if (s.mealsLogged > 0) logged.add(s.entryDate);
  return computeStreak(logged, today);
}

/** Weight-trend window ending at the card's date. */
export const WEIGHT_TREND_DAYS = 7;

/** Below this |delta| the trend reads as flat. */
const WEIGHT_FLAT_BAND_KG = 0.2;

/** Only the two columns a trend needs, so callers can pass lightweight rows. */
export type WeighInFacts = { entryDate: string; weightKg: number | null };

/**
 * First-vs-last weigh-in inside the window; needs two points to call a
 * direction.
 */
export function weightTrendFrom(
  summaries: WeighInFacts[],
  endDate: string,
): WeightTrendFacts {
  const startDate = addDays(endDate, -(WEIGHT_TREND_DAYS - 1));
  const points = summaries
    .filter(
      (s) =>
        s.weightKg !== null &&
        s.entryDate >= startDate &&
        s.entryDate <= endDate,
    )
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  if (points.length < 2) return { deltaKg: null, direction: null };
  const delta =
    Math.round(((points[points.length - 1].weightKg ?? 0) - (points[0].weightKg ?? 0)) * 100) / 100;
  const direction =
    Math.abs(delta) < WEIGHT_FLAT_BAND_KG ? "flat" : delta > 0 ? "up" : "down";
  return { deltaKg: delta, direction };
}
