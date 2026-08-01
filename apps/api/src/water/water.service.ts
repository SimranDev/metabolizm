import {
  userProfiles,
  users,
  waterEntries,
  waterGoals,
  weightEntries,
} from "@metabolizm/db";
import {
  defaultWaterGoalMl,
  type WaterDayDto,
  type WaterEntriesResponse,
  type WaterEntryDto,
  type WaterGoalDto,
  type WaterSummaryResponse,
} from "@metabolizm/shared";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { uuidv7 } from "uuidv7";

import { DB, type Database } from "../db/db.module";
import { addDays, dateRange, localDateFor } from "../groups/dates";
import type {
  CreateWaterEntryInput,
  PutWaterGoalInput,
  WaterEntriesQuery,
  WaterSummaryQuery,
} from "./water.schemas";

type WaterRow = typeof waterEntries.$inferSelect;

// Bumped in SQL rather than read-modify-write, so two concurrent retries of the
// same queued log can't land on the same version.
const bumpVersion = sql`${waterEntries.version} + 1`;

/** Streak lookback. Longer than any plausible unbroken run. */
const STREAK_LOOKBACK_DAYS = 400;

// Keyset cursor over (logged_at, id) descending — the history list's order.
const cursorSchema = z.object({
  t: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

type CursorPayload = z.output<typeof cursorSchema>;

const encodeCursor = (cursor: CursorPayload): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

function decodeCursor(raw: string): CursorPayload {
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

export function toWaterEntryDto(row: WaterRow): WaterEntryDto {
  return {
    id: row.id,
    entryDate: row.entryDate,
    volumeMl: row.volumeMl,
    loggedAt: row.loggedAt.toISOString(),
    source: row.source,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/**
 * Hydration logging — reads and writes in one service, because unlike weight
 * there is no trend, projection or bucketing to keep apart from the writes.
 *
 * Note what this module does NOT do: touch `daily_summaries`. That row has
 * exactly two writers with deliberately disjoint SET maps, and a third is a new
 * way for them to clobber each other. Hydration is also absent from every group
 * share_config, so nothing outside the owner ever reads it — it has no business
 * in the read model that exists to serve group feeds. `WaterModule` therefore
 * does not import `SummariesModule`, and that absence is load-bearing.
 */
@Injectable()
export class WaterService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async timezoneOf(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId));
    return row?.timezone ?? "UTC";
  }

  /**
   * Bodyweight for the derived default goal: the latest weigh-in, falling back
   * to the onboarding profile snapshot.
   *
   * Read directly rather than through `WeightModule`. This needs one scalar and
   * no behaviour, so importing a module for it would buy a dependency edge and
   * nothing else — and the fallback belongs to whoever is deriving the default,
   * not to the weight vertical.
   */
  private async bodyweightKg(userId: string): Promise<number | null> {
    const [latest] = await this.db
      .select({ weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(
        and(eq(weightEntries.userId, userId), isNull(weightEntries.deletedAt)),
      )
      .orderBy(desc(weightEntries.entryDate), desc(weightEntries.loggedAt))
      .limit(1);
    if (latest) return latest.weightKg;

    const [profile] = await this.db
      .select({ weightKg: userProfiles.weightKg })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile?.weightKg ?? null;
  }

  /**
   * The goal in force. An absent row is not a goal of zero — it means the user
   * has never set one, so the bodyweight-derived default applies and the
   * response says `isCustom: false` so the UI can present it as a suggestion.
   */
  async goalFor(userId: string): Promise<WaterGoalDto> {
    const [row] = await this.db
      .select()
      .from(waterGoals)
      .where(eq(waterGoals.userId, userId));

    if (row) {
      return {
        dailyGoalMl: row.dailyGoalMl,
        isCustom: true,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    return {
      dailyGoalMl: defaultWaterGoalMl(await this.bodyweightKg(userId)),
      isCustom: false,
      updatedAt: null,
    };
  }

  async putGoal(
    userId: string,
    input: PutWaterGoalInput,
  ): Promise<WaterGoalDto> {
    const now = new Date();
    const [row] = await this.db
      .insert(waterGoals)
      .values({ userId, dailyGoalMl: input.dailyGoalMl, updatedAt: now })
      .onConflictDoUpdate({
        target: waterGoals.userId,
        set: { dailyGoalMl: input.dailyGoalMl, updatedAt: now },
      })
      .returning();

    return {
      dailyGoalMl: row.dailyGoalMl,
      isCustom: true,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Logs a drink. `id` is a client-supplied UUIDv7 so a queued offline log that
   * gets retried is an idempotent upsert rather than a second glass.
   */
  async create(
    userId: string,
    input: CreateWaterEntryInput,
  ): Promise<WaterEntryDto> {
    // entry_date comes from the client — the device knows its own calendar day,
    // and deriving it from logged_at server-side is the classic bug that files
    // an 11pm drink under tomorrow.
    const today = localDateFor(await this.timezoneOf(userId));
    if (input.entryDate > addDays(today, 1)) {
      throw new BadRequestException("entryDate is too far in the future");
    }

    const now = new Date();
    const snapshot = {
      entryDate: input.entryDate,
      volumeMl: input.volumeMl,
      loggedAt: new Date(input.loggedAt),
      source: input.source,
    };

    const [row] = await this.db
      .insert(waterEntries)
      .values({ id: input.id ?? uuidv7(), userId, ...snapshot, updatedAt: now })
      .onConflictDoUpdate({
        target: waterEntries.id,
        set: { ...snapshot, updatedAt: now, version: bumpVersion },
      })
      .returning();

    return toWaterEntryDto(row);
  }

  /** Idempotent soft delete; removing an already-removed entry is a no-op. */
  async remove(userId: string, id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(waterEntries)
      .set({ deletedAt: now, updatedAt: now, version: bumpVersion })
      .where(
        and(
          eq(waterEntries.id, id),
          eq(waterEntries.userId, userId),
          isNull(waterEntries.deletedAt),
        ),
      );
  }

  /** Per-day totals across an inclusive date window, days with rows only. */
  private async totalsBetween(
    userId: string,
    from: string,
    to: string,
  ): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        date: waterEntries.entryDate,
        totalMl: sql<number>`sum(${waterEntries.volumeMl})::int`,
      })
      .from(waterEntries)
      .where(
        and(
          eq(waterEntries.userId, userId),
          isNull(waterEntries.deletedAt),
          gte(waterEntries.entryDate, from),
          lte(waterEntries.entryDate, to),
        ),
      )
      .groupBy(waterEntries.entryDate);

    return new Map(rows.map((r) => [r.date, r.totalMl]));
  }

  /**
   * The tile and detail payload.
   *
   * Today is the caller's own local date per `users.timezone`, never one global
   * date — the same rule every group read follows.
   */
  async summary(
    userId: string,
    query: WaterSummaryQuery,
  ): Promise<WaterSummaryResponse> {
    const today = localDateFor(await this.timezoneOf(userId));
    const goal = await this.goalFor(userId);

    const windowStart = addDays(today, -(query.days - 1));
    const streakStart = addDays(today, -STREAK_LOOKBACK_DAYS);

    const [totals, entries] = await Promise.all([
      this.totalsBetween(userId, streakStart, today),
      this.db
        .select()
        .from(waterEntries)
        .where(
          and(
            eq(waterEntries.userId, userId),
            isNull(waterEntries.deletedAt),
            eq(waterEntries.entryDate, today),
          ),
        )
        .orderBy(desc(waterEntries.loggedAt), desc(waterEntries.id)),
    ]);

    // A day inside the window with no rows really did total zero; a day outside
    // it is simply absent, which the client reads as "not covered" rather than
    // "drank nothing".
    const days: WaterDayDto[] = dateRange(windowStart, query.days).map(
      (date) => ({ date, totalMl: totals.get(date) ?? 0 }),
    );

    return {
      date: today,
      totalMl: totals.get(today) ?? 0,
      goal,
      entries: entries.map(toWaterEntryDto),
      days,
      streakDays: countStreak(today, totals, goal.dailyGoalMl),
    };
  }

  async listEntries(
    userId: string,
    query: WaterEntriesQuery,
  ): Promise<WaterEntriesResponse> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.db
      .select()
      .from(waterEntries)
      .where(
        and(
          eq(waterEntries.userId, userId),
          isNull(waterEntries.deletedAt),
          cursor
            ? sql`(${waterEntries.loggedAt}, ${waterEntries.id}) < (${new Date(cursor.t)}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(waterEntries.loggedAt), desc(waterEntries.id))
      // One extra row tells us whether another page exists without a count(*).
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);

    return {
      entries: page.map(toWaterEntryDto),
      nextCursor:
        hasMore && last
          ? encodeCursor({ t: last.loggedAt.toISOString(), id: last.id })
          : null,
      hasMore,
    };
  }
}

/**
 * Consecutive days ending today that met the goal.
 *
 * Today is exempt from breaking the run: at 9am you have not failed to drink
 * your daily target, you just haven't yet. A streak that resets every midnight
 * and only recovers late in the evening measures the clock, not the habit.
 */
export function countStreak(
  today: string,
  totals: Map<string, number>,
  goalMl: number,
): number {
  let streak = 0;
  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i += 1) {
    const date = addDays(today, -i);
    const met = (totals.get(date) ?? 0) >= goalMl;
    if (met) {
      streak += 1;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return streak;
}
