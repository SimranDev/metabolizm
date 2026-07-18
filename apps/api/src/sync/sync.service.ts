import { diaryEntries } from "@metabolizm/db";
import type { SyncDiaryResponse } from "@metabolizm/shared";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { DB, type Database } from "../db/db.module";
import { toDiaryEntryDto } from "../diary/diary.service";
import type { SyncDiaryQuery } from "./sync.schemas";

// Keyset cursor over (updated_at, id) — the delta-pull ORDER BY. Opaque to
// clients; updated_at round-trips exactly because the diary service always
// writes it from a JS Date (ms precision), never from now() (µs).
const cursorSchema = z.object({
  u: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

type CursorPayload = z.output<typeof cursorSchema>;

function encodeCursor(cursor: CursorPayload): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): CursorPayload {
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

@Injectable()
export class SyncService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Delta pull: every row (tombstones included) with (updated_at, id) past
   * the cursor, in that order. The client applies pages as they arrive and
   * persists nextCursor after each one.
   */
  async pullDiary(
    userId: string,
    query: SyncDiaryQuery,
  ): Promise<SyncDiaryResponse> {
    const filters: SQL[] = [eq(diaryEntries.userId, userId)];
    if (query.since !== undefined) {
      const cursor = decodeCursor(query.since);
      // Bound as ISO strings with casts: raw params in a sql fragment skip
      // drizzle's column mapping, and postgres-js won't serialize a Date there.
      filters.push(
        sql`(${diaryEntries.updatedAt}, ${diaryEntries.id}) > (${cursor.u}::timestamptz, ${cursor.id}::uuid)`,
      );
    }
    const rows = await this.db
      .select()
      .from(diaryEntries)
      .where(and(...filters))
      .orderBy(asc(diaryEntries.updatedAt), asc(diaryEntries.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      entries: page.map(toDiaryEntryDto),
      nextCursor: last
        ? encodeCursor({ u: last.updatedAt.toISOString(), id: last.id })
        : (query.since ?? null),
      hasMore,
    };
  }
}
