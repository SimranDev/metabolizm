/**
 * Routes for the Sync tab — pull test accounts from the LIVE database into the
 * local one. The copying itself lives in sync-plan.ts; this file is the guard
 * rail and the HTTP shape.
 *
 * Three refusals, all of them before anything is read or written:
 *   1. No SOURCE_DATABASE_URL → sync reports itself unconfigured. Not an error:
 *      most of this tool has nothing to do with live.
 *   2. Source and target the same database → nothing to sync, and the request
 *      is almost certainly a mistake about which URL is which.
 *   3. TARGET NOT A LOOPBACK HOST → refused outright, with no override. This is
 *      the one that matters: DATABASE_URL is the WRITE side, and an operator
 *      who has temporarily pointed it at a hosted database (to fix a system
 *      food, say) would otherwise turn "pull live into local" into "push local
 *      into production". A dev tool with no auth does not get to make that
 *      mistake possible.
 *
 * Unlike review.ts — which edits user rows one at a time and is careful to say
 * so — these routes copy whole user graphs. They are a mirror, not an editor:
 * nothing here derives, recomputes or corrects a value, so no invariant that
 * the api enforces on write can be violated by a row arriving through it.
 */
import { diaryEntries, foods, groupMembers, users, weightEntries } from "@metabolizm/db";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  createDb,
  describeConnection,
  findPgError,
  sameDatabase,
  type Database,
  type DbIdentity,
} from "./db";
import type { Env } from "./env";
import { runSync, type SyncPlan } from "./sync-plan";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const syncBodySchema = z.object({
  // Capped low on purpose: this is for pulling a handful of test accounts, not
  // for cloning a production database onto a laptop.
  userIds: z.array(z.uuid()).min(1).max(20),
  includeGroups: z.boolean().default(true),
  prune: z.boolean().default(false),
});

export type SyncStatus = {
  configured: boolean;
  ready: boolean;
  /** Why sync is unavailable, in words meant for the operator. */
  reason: string | null;
  source: DbIdentity | null;
  target: DbIdentity;
};

export type SyncUserRow = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  region: string;
  createdAt: string;
  live: { diaryEntries: number; weightEntries: number; groups: number; foods: number };
  /** null when the account does not exist locally at all. */
  local: { diaryEntries: number; weightEntries: number } | null;
};

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply
    .code(400)
    .send({ error: "validation_failed", message: z.prettifyError(error) });
}

/** Every read of the live database goes through this. */
function readOnly<T>(db: Database, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn, { accessMode: "read only" });
}

async function countsByUser(
  tx: Tx,
  userIds: string[],
): Promise<{
  diary: Map<string, number>;
  weight: Map<string, number>;
  groups: Map<string, number>;
  foods: Map<string, number>;
}> {
  const empty = {
    diary: new Map<string, number>(),
    weight: new Map<string, number>(),
    groups: new Map<string, number>(),
    foods: new Map<string, number>(),
  };
  if (userIds.length === 0) return empty;

  const n = sql<number>`count(*)::int`;
  const [diary, weight, groups, ownedFoods] = await Promise.all([
    tx
      .select({ userId: diaryEntries.userId, n })
      .from(diaryEntries)
      .where(and(inArray(diaryEntries.userId, userIds), isNull(diaryEntries.deletedAt)))
      .groupBy(diaryEntries.userId),
    tx
      .select({ userId: weightEntries.userId, n })
      .from(weightEntries)
      .where(
        and(inArray(weightEntries.userId, userIds), isNull(weightEntries.deletedAt)),
      )
      .groupBy(weightEntries.userId),
    tx
      .select({ userId: groupMembers.userId, n })
      .from(groupMembers)
      .where(
        and(inArray(groupMembers.userId, userIds), eq(groupMembers.status, "active")),
      )
      .groupBy(groupMembers.userId),
    tx
      .select({ userId: foods.ownerId, n })
      .from(foods)
      .where(and(inArray(foods.ownerId, userIds), isNull(foods.deletedAt)))
      .groupBy(foods.ownerId),
  ]);

  return {
    diary: new Map(diary.map((row) => [row.userId, row.n])),
    weight: new Map(weight.map((row) => [row.userId, row.n])),
    groups: new Map(groups.map((row) => [row.userId, row.n])),
    foods: new Map(
      ownedFoods.flatMap((row) => (row.userId ? [[row.userId, row.n] as const] : [])),
    ),
  };
}

export function registerSyncRoutes(
  app: FastifyInstance,
  db: Database,
  env: Env,
): void {
  const target = describeConnection(env.DATABASE_URL);
  const source = env.SOURCE_DATABASE_URL
    ? describeConnection(env.SOURCE_DATABASE_URL)
    : null;

  const status: SyncStatus = {
    configured: source !== null,
    ready: false,
    reason: null,
    source,
    target,
  };
  if (!source) {
    status.reason =
      "SOURCE_DATABASE_URL is not set. Add the live connection string to apps/admin/.env to enable sync.";
  } else if (sameDatabase(source, target)) {
    status.reason = `SOURCE_DATABASE_URL and DATABASE_URL point at the same database (${target.host}:${target.port}/${target.database}).`;
  } else if (!target.loopback) {
    status.reason = `DATABASE_URL is the WRITE side and points at ${target.host}, which is not a local host. Sync only ever writes to a local database — check the two URLs are not swapped.`;
  } else {
    status.ready = true;
  }

  // Dialed lazily so booting the admin tool never reaches out to live, and only
  // once so repeated previews reuse the pool.
  let sourceDb: Database | null = null;
  const openSource = (): Database => {
    sourceDb ??= createDb(env.SOURCE_DATABASE_URL!, { max: 4 });
    return sourceDb;
  };
  app.addHook("onClose", async () => {
    if (sourceDb) await sourceDb.$client.end();
  });

  const unavailable = (reply: FastifyReply) =>
    reply.code(400).send({ error: "sync_unavailable", message: status.reason });

  app.get("/api/sync/status", () => status);

  /** Candidate accounts on live, with how much data each one carries. */
  app.get("/api/sync/users", async (request, reply) => {
    if (!status.ready) return unavailable(reply);
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const { q, limit } = parsed.data;

    const rows = await readOnly(openSource(), async (tx) => {
      const matches = await tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          timezone: users.timezone,
          region: users.region,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined,
        )
        .orderBy(desc(users.createdAt))
        .limit(limit);
      return { matches, counts: await countsByUser(tx, matches.map((r) => r.id)) };
    });

    const ids = rows.matches.map((row) => row.id);
    const local = await readOnly(db, async (tx) => {
      const present = ids.length
        ? await tx.select({ id: users.id }).from(users).where(inArray(users.id, ids))
        : [];
      return {
        present: new Set(present.map((row) => row.id)),
        counts: await countsByUser(tx, ids),
      };
    });

    const items: SyncUserRow[] = rows.matches.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      timezone: row.timezone,
      region: row.region,
      createdAt: row.createdAt.toISOString(),
      live: {
        diaryEntries: rows.counts.diary.get(row.id) ?? 0,
        weightEntries: rows.counts.weight.get(row.id) ?? 0,
        groups: rows.counts.groups.get(row.id) ?? 0,
        foods: rows.counts.foods.get(row.id) ?? 0,
      },
      local: local.present.has(row.id)
        ? {
            diaryEntries: local.counts.diary.get(row.id) ?? 0,
            weightEntries: local.counts.weight.get(row.id) ?? 0,
          }
        : null,
    }));

    return reply.send({ items });
  });

  const execute = async (
    reply: FastifyReply,
    body: unknown,
    apply: boolean,
  ): Promise<FastifyReply> => {
    if (!status.ready) return unavailable(reply);
    const parsed = syncBodySchema.safeParse(body);
    if (!parsed.success) return validationError(reply, parsed.error);

    let plan: SyncPlan;
    try {
      plan = await runSync(openSource(), db, { ...parsed.data, apply });
    } catch (error) {
      const pg = findPgError(error);
      if (pg) {
        // The local transaction rolled back, so nothing landed half-applied.
        return reply.code(409).send({
          error: "sync_failed",
          message: `Postgres ${pg.code}${pg.constraint_name ? ` on ${pg.constraint_name}` : ""}: ${pg.message}. Nothing was written — the sync ran in a single transaction.`,
        });
      }
      throw error;
    }

    // Refuse rather than write half a graph: a blocker means a unique key is
    // held locally by a different row and only the operator can say which wins.
    if (apply && plan.blockers.length > 0) {
      return reply.code(409).send({
        error: "sync_blocked",
        message: plan.blockers.map((b) => b.message).join(" "),
        plan,
      });
    }
    return reply.send(plan);
  };

  /** Preview. The local transaction is opened `read only`, so it cannot write. */
  app.post("/api/sync/plan", (request, reply) =>
    execute(reply, request.body, false),
  );

  app.post("/api/sync/apply", (request, reply) =>
    execute(reply, request.body, true),
  );
}
