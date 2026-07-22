import { dailySummaries, users } from "@metabolizm/db";
import type { DaySummaryDto, SummaryDaysResponse } from "@metabolizm/shared";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, gte, lte } from "drizzle-orm";

import { DB, type Database } from "../db/db.module";
import { computeStreak } from "../groups/adherence";
import { addDays, localDateFor } from "../groups/dates";
import type { SummaryDaysQuery } from "./summaries.schemas";

/** Streak lookback. Longer than any plausible unbroken run. */
const STREAK_LOOKBACK_DAYS = 400;

type SummaryRow = typeof dailySummaries.$inferSelect;

export function toDaySummaryDto(row: SummaryRow): DaySummaryDto {
  return {
    date: row.entryDate,
    energyKcal: row.energyKcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    mealsLogged: row.mealsLogged,
    mealNames: row.mealNames,
    targetKcal: row.targetKcal,
    targetProteinG: row.targetProteinG,
    targetCarbsG: row.targetCarbsG,
    targetFatG: row.targetFatG,
    weightKg: row.weightKg,
  };
}

/**
 * Read side of the daily rollup — the caller's OWN summaries, so nothing here
 * goes through groups/masking.ts. (Anything reading another member's rows
 * still must; see the groups read service.)
 */
@Injectable()
export class SummariesReadService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listDays(
    userId: string,
    query: SummaryDaysQuery,
  ): Promise<SummaryDaysResponse> {
    const today = await this.todayFor(userId);
    const [rows, loggingStreak] = await Promise.all([
      this.db
        .select()
        .from(dailySummaries)
        .where(
          and(
            eq(dailySummaries.userId, userId),
            gte(dailySummaries.entryDate, query.from),
            lte(dailySummaries.entryDate, query.to),
          ),
        )
        .orderBy(asc(dailySummaries.entryDate)),
      this.loggingStreak(userId, today),
    ]);

    // Sparse on purpose: a day with no row means "nothing logged", which the
    // client must render differently from a logged zero. Filling the gaps here
    // would erase that distinction before it ever reached the UI.
    return { today, days: rows.map(toDaySummaryDto), loggingStreak };
  }

  /** The caller's own current local date — what every server-side day pivots on. */
  private async todayFor(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return localDateFor(row?.timezone ?? "UTC");
  }

  /**
   * Consecutive logged days ending today (or yesterday).
   *
   * Its own query rather than a fold over the requested range: the streak is a
   * property of the account, not of the window being browsed, so paging back to
   * March must not report March's streak. Days after `today` are excluded so a
   * planned future day can never inflate it.
   */
  private async loggingStreak(userId: string, today: string): Promise<number> {
    const rows = await this.db
      .select({ d: dailySummaries.entryDate })
      .from(dailySummaries)
      .where(
        and(
          eq(dailySummaries.userId, userId),
          gt(dailySummaries.mealsLogged, 0),
          lte(dailySummaries.entryDate, today),
          gte(dailySummaries.entryDate, addDays(today, -STREAK_LOOKBACK_DAYS)),
        ),
      );
    return computeStreak(new Set(rows.map((r) => r.d)), today);
  }
}
