/**
 * One-off backfill of daily_summaries from existing diary_entries.
 *
 *   pnpm --filter api backfill:summaries          (dev; loads apps/api/.env)
 *   node dist/summaries/backfill.js               (inside the api image)
 *
 * Never runs automatically. Idempotent — recomputing a day that already has
 * a summary rewrites it with the same values, so re-running is safe. Uses the
 * same SummariesService as the live diary write path, so backfilled rows and
 * incrementally-maintained rows can't drift apart.
 *
 * Lives in src/ (not a scripts/ dir) so `nest build` compiles it into dist/
 * and it ships with the production image, like @metabolizm/db's migrate.js.
 */
import * as schema from "@metabolizm/db";
import { diaryEntries } from "@metabolizm/db";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { SummariesService } from "./summaries.service";

const PROGRESS_EVERY = 200;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const client = postgres(url);
  const db = drizzle(client, { schema });
  // No DI here: SummariesService takes its executor per call.
  const summaries = new SummariesService();

  try {
    const days = await db
      .selectDistinct({
        userId: diaryEntries.userId,
        entryDate: diaryEntries.entryDate,
      })
      .from(diaryEntries)
      .orderBy(diaryEntries.userId, diaryEntries.entryDate);

    console.log(`Backfilling ${days.length} (user, day) summaries…`);
    let done = 0;
    for (const day of days) {
      // Per-day transaction: a failure halfway leaves earlier days
      // backfilled, and re-running resumes safely.
      await db.transaction((tx) =>
        summaries.recomputeDay(tx, day.userId, day.entryDate),
      );
      done += 1;
      if (done % PROGRESS_EVERY === 0) {
        console.log(`  ${done}/${days.length}`);
      }
    }
    console.log(`Backfill complete: ${done} summaries written.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
