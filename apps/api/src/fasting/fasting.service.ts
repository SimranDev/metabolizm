import { fastingSessions } from "@metabolizm/db";
import {
  FAST_MAX_BACKDATE_HOURS,
  type FastingSessionDto,
  type FastingSessionsResponse,
} from "@metabolizm/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { isPgError } from "../common/pg-error";
import { DB, type Database } from "../db/db.module";
import type {
  EndFastInput,
  FastingSessionsQuery,
  StartFastInput,
} from "./fasting.schemas";

type FastingRow = typeof fastingSessions.$inferSelect;

// Bumped in SQL rather than read-modify-write, so two concurrent writes can't
// land on the same version.
const bumpVersion = sql`${fastingSessions.version} + 1`;

const HOUR_MS = 3_600_000;

// Keyset cursor over (started_at, id) descending — the history list's order.
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

export function toFastingSessionDto(row: FastingRow): FastingSessionDto {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    targetHours: row.targetHours,
    protocol: row.protocol,
    note: row.note,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/**
 * The fasting timer.
 *
 * Only `started_at` and `ended_at` are stored — elapsed is derived on read, so
 * there is nothing to keep ticking and nothing to go stale while the app is
 * closed.
 *
 * Like `WaterService`, this deliberately never touches `daily_summaries`: that
 * row has two writers with disjoint SET maps, and fasting is in no group
 * share_config, so it neither belongs in the read model nor needs to recompute
 * anything. `FastingModule` imports no `SummariesModule`.
 */
@Injectable()
export class FastingService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** The open fast, if there is one. Null is a state, not an error. */
  async current(userId: string): Promise<FastingSessionDto | null> {
    const [row] = await this.db
      .select()
      .from(fastingSessions)
      .where(
        and(
          eq(fastingSessions.userId, userId),
          isNull(fastingSessions.endedAt),
          isNull(fastingSessions.deletedAt),
        ),
      )
      .limit(1);
    return row ? toFastingSessionDto(row) : null;
  }

  /**
   * Starts a fast.
   *
   * A second start while one is running is a 409, not a silent second row: the
   * partial unique index makes that impossible at the database level anyway, so
   * the check here is about giving the caller an honest answer rather than a
   * 23505 surfaced as a 500. The insert is still guarded, because two requests
   * can pass the check concurrently and only the index settles it.
   */
  async start(
    userId: string,
    input: StartFastInput,
  ): Promise<FastingSessionDto> {
    const now = new Date();
    const startedAt = input.startedAt ? new Date(input.startedAt) : now;

    if (startedAt.getTime() > now.getTime() + 60_000) {
      throw new BadRequestException("A fast can't start in the future.");
    }
    if (now.getTime() - startedAt.getTime() > FAST_MAX_BACKDATE_HOURS * HOUR_MS) {
      throw new BadRequestException(
        `A fast can only be backdated ${FAST_MAX_BACKDATE_HOURS} hours.`,
      );
    }

    const open = await this.current(userId);
    if (open) {
      throw new ConflictException("You already have a fast running.");
    }

    try {
      const [row] = await this.db
        .insert(fastingSessions)
        .values({
          id: input.id ?? uuidv7(),
          userId,
          startedAt,
          targetHours: input.targetHours,
          protocol: input.protocol,
          note: input.note ?? null,
          updatedAt: now,
        })
        // A retried offline start carries the same id and must land as the
        // same fast. Scoped to the id, so it can never absorb a *different*
        // open fast — that case is the 23505 below.
        .onConflictDoUpdate({
          target: fastingSessions.id,
          set: {
            startedAt,
            targetHours: input.targetHours,
            protocol: input.protocol,
            updatedAt: now,
            version: bumpVersion,
          },
        })
        .returning();
      return toFastingSessionDto(row);
    } catch (error) {
      if (isPgError(error, "23505")) {
        throw new ConflictException("You already have a fast running.");
      }
      throw error;
    }
  }

  /**
   * Ends or edits a fast.
   *
   * **Sending `endedAt` is what ends it** — there is no implicit "close it
   * now". Two reasons. A note-only patch must not silently stop a running
   * fast, and the client already holds the moment the user tapped Stop, which
   * is more accurate than server-now for a stop that sat in an offline queue
   * for an hour.
   *
   * Ending an already-ended fast 409s rather than moving its end time: the
   * usual way to get here is a double-tap on Stop, and silently rewriting the
   * duration of a finished fast is worse than saying no.
   */
  async patch(
    userId: string,
    id: string,
    input: EndFastInput,
  ): Promise<FastingSessionDto> {
    const [existing] = await this.db
      .select()
      .from(fastingSessions)
      .where(
        and(
          eq(fastingSessions.id, id),
          eq(fastingSessions.userId, userId),
          isNull(fastingSessions.deletedAt),
        ),
      );

    if (!existing) throw new NotFoundException("Fast not found");

    let endedAt: Date | undefined;
    if (input.endedAt !== undefined) {
      if (existing.endedAt !== null) {
        throw new ConflictException("That fast has already ended.");
      }
      endedAt = new Date(input.endedAt);
      if (endedAt.getTime() <= existing.startedAt.getTime()) {
        throw new BadRequestException("A fast can't end before it started.");
      }
    }

    const now = new Date();
    const [row] = await this.db
      .update(fastingSessions)
      .set({
        ...(endedAt !== undefined ? { endedAt } : {}),
        ...(input.targetHours !== undefined
          ? { targetHours: input.targetHours }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedAt: now,
        version: bumpVersion,
      })
      .where(
        and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId)),
      )
      .returning();

    return toFastingSessionDto(row);
  }

  /** Idempotent soft delete; removing an already-removed fast is a no-op. */
  async remove(userId: string, id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(fastingSessions)
      .set({ deletedAt: now, updatedAt: now, version: bumpVersion })
      .where(
        and(
          eq(fastingSessions.id, id),
          eq(fastingSessions.userId, userId),
          isNull(fastingSessions.deletedAt),
        ),
      );
  }

  async list(
    userId: string,
    query: FastingSessionsQuery,
  ): Promise<FastingSessionsResponse> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.db
      .select()
      .from(fastingSessions)
      .where(
        and(
          eq(fastingSessions.userId, userId),
          isNull(fastingSessions.deletedAt),
          cursor
            ? sql`(${fastingSessions.startedAt}, ${fastingSessions.id}) < (${new Date(cursor.t)}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(fastingSessions.startedAt), desc(fastingSessions.id))
      // One extra row tells us whether another page exists without a count(*).
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);

    return {
      sessions: page.map(toFastingSessionDto),
      nextCursor:
        hasMore && last
          ? encodeCursor({ t: last.startedAt.toISOString(), id: last.id })
          : null,
      hasMore,
    };
  }
}
