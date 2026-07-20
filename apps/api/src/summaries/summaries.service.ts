import { dailySummaries, diaryEntries, userTargets } from "@metabolizm/db";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, lte } from "drizzle-orm";

import type { Database } from "../db/db.module";
import { computeDaySummary } from "./compute";

// A drizzle transaction handle — recompute runs INSIDE the caller's diary
// write transaction so a summary can never go out of sync with its entries.
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | Tx;

@Injectable()
export class SummariesService {
  /**
   * Idempotent upsert of the (user, day) daily_summaries row from its diary
   * entries. Targets are snapshotted from the user_targets row effective FOR
   * entry_date (not today's), so recomputing a past day never picks up a
   * later target change. weight_kg is deliberately left untouched — it's
   * owned by a future weight-log write path.
   */
  async recomputeDay(
    db: DbExecutor,
    userId: string,
    entryDate: string,
  ): Promise<void> {
    const entries = await db
      .select({
        meal: diaryEntries.meal,
        name: diaryEntries.name,
        energyKcal: diaryEntries.energyKcal,
        proteinG: diaryEntries.proteinG,
        carbsG: diaryEntries.carbsG,
        fatG: diaryEntries.fatG,
        loggedAt: diaryEntries.loggedAt,
        deletedAt: diaryEntries.deletedAt,
      })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, userId),
          eq(diaryEntries.entryDate, entryDate),
        ),
      );

    // The target effective FOR this day: latest effective_from <= entry_date
    // (created_at breaks ties). Snapshotting by the day being recomputed —
    // not by today — is what keeps a later target change from rewriting past
    // adherence.
    const [target] = await db
      .select()
      .from(userTargets)
      .where(
        and(
          eq(userTargets.userId, userId),
          lte(userTargets.effectiveFrom, entryDate),
        ),
      )
      .orderBy(desc(userTargets.effectiveFrom), desc(userTargets.createdAt))
      .limit(1);

    const totals = computeDaySummary(entries);
    const snapshot = {
      ...totals,
      targetKcal: target?.energyKcal ?? null,
      targetProteinG: target?.proteinG ?? null,
      targetCarbsG: target?.carbsG ?? null,
      targetFatG: target?.fatG ?? null,
      updatedAt: new Date(),
    };
    await db
      .insert(dailySummaries)
      .values({ userId, entryDate, ...snapshot })
      .onConflictDoUpdate({
        target: [dailySummaries.userId, dailySummaries.entryDate],
        set: snapshot,
      });
  }

  async recomputeDays(
    db: DbExecutor,
    userId: string,
    entryDates: Iterable<string>,
  ): Promise<void> {
    for (const entryDate of new Set(entryDates)) {
      await this.recomputeDay(db, userId, entryDate);
    }
  }
}
