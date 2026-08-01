/**
 * Live → local database sync engine.
 *
 * ONE DIRECTION, ALWAYS. The live database is a read-only SOURCE: every read
 * of it runs inside a `read only` transaction, and nothing here ever opens a
 * write path to it. The local database is the only thing written, and
 * server/sync.ts refuses to run at all unless DATABASE_URL points at a
 * loopback host — so a `.env` with the two URLs swapped fails loudly instead of
 * pushing local test data into production.
 *
 * What it copies is a USER GRAPH, not a database. You pick accounts on live
 * and get those rows plus everything hanging off them, in FK order, as an
 * upsert. Deliberately NOT copied:
 *   - `sessions`   — a cookie bound to live's BETTER_AUTH_SECRET is useless
 *                    locally, and a stale one is worse than none.
 *   - `verifications` — short-lived email tokens; nothing reads them later.
 *   - `device_push_tokens` — a token means "this physical phone is signed in
 *                    THERE". Copying one would let a local dev send fire a
 *                    real notification at a real device.
 * `accounts` IS copied, because without it the synced user exists but cannot
 * sign in — the credential hash is what makes a test user testable.
 *
 * Two things stop the copy from being a naive INSERT:
 *
 *  1. SURROGATE IDS DIFFER BETWEEN DATABASES. Both sides ran the USDA import
 *     separately, so the same food carries the same `source_ref` under two
 *     different UUIDs. Inserting live's UUID trips foods_source_ref_active_uq
 *     forever. So specs may declare NATURAL KEYS: when an incoming row matches
 *     a local row on one, the incoming row adopts the LOCAL id, and every FK
 *     pointing at it is rewritten (see `remap`). Barcode is deliberately NOT a
 *     natural key — two records sharing a barcode may be genuinely different
 *     rows, and silently overwriting one is exactly the kind of quiet, plausible
 *     wrongness this repo refuses; those surface as blockers instead.
 *
 *  2. PRUNE RUNS BEFORE INSERT. Deleting local-only rows first is not just
 *     tidiness: a local-only row sitting in a partial unique index (an `active`
 *     group_members row for a pair live also has) would 23505 the insert that
 *     is meant to replace it.
 */
import {
  accounts,
  dailySummaries,
  diaryEntries,
  fastingSessions,
  foodPortions,
  foodReports,
  foodReviews,
  foods,
  groupInteractions,
  groupInvites,
  groupJoinRequests,
  groupMembers,
  groups,
  userProfiles,
  userTargets,
  userWeightGoals,
  users,
  waterEntries,
  waterGoals,
  weightEntries,
} from "@metabolizm/db";
import { and, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { Database } from "./db";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Row = Record<string, unknown>;

/** Names for the report, so a row reads as "alex@x.com · 2026-07-12 lunch". */
type NameMaps = {
  user: Map<string, string>;
  group: Map<string, string>;
};

type Ctx = {
  /** The accounts the operator picked. Their rows are the prunable scope. */
  primaryIds: string[];
  /** Every user id in the snapshot, primary + pulled-in dependencies. */
  allUserIds: string[];
  /** Groups reachable from the primaries, on either side. */
  groupIds: string[];
  /** Local foods owned by a primary — the scope for portion/review children. */
  localOwnedFoodIds: string[];
  sourceRefs: string[];
  names: NameMaps;
};

type Spec = {
  /** Report label; two specs may share a table (see foods, owned vs referenced). */
  key: string;
  table: PgTable;
  /** Property names of the primary-key columns. */
  pkProps: string[];
  /**
   * Alternative identities a row can be matched on when the ids differ between
   * databases. First hit wins; an empty list means "id only".
   */
  naturalKeys?: (row: Row) => string[];
  label: (row: Row, names: NameMaps) => string;
  /**
   * Rows only ever inserted, never updated from live. Used for foods the
   * selected users merely REFERENCE (system/other-people's): they are pulled to
   * satisfy `diary_entries.food_id`, not to be synced, so a local copy is left
   * exactly as it is — including any admin correction made to it here.
   */
  insertOnly?: boolean;
  prunable: boolean;
  /**
   * Skipped entirely when `includeGroups` is off. Not cosmetic: ctx.groupIds
   * includes groups found on the LOCAL side, so a spec left running with an
   * empty snapshot would report every local group row as local-only — and
   * prune would then delete the memberships of a feature the operator just
   * asked to leave alone.
   */
  groupScoped?: boolean;
  /** Local rows counted as "the selected users' own" for local-only/prune. */
  scopeWhere?: (ctx: Ctx) => SQL | undefined;
  /** Extra local rows to load so natural-key matching can see them. */
  candidateWhere?: (ctx: Ctx) => SQL | undefined;
  /** FK columns pointing at `foods`, rewritten through the id remap. */
  foodRefProps?: string[];
  /** When a food ref is remapped, the whole child row is dropped instead. */
  dropWhenFoodRemapped?: boolean;
  /** User ids this row references — pulled in as dependency users. */
  userRefs?: (row: Row) => (string | null)[];
};

// ---------------------------------------------------------------------------
// Report shapes (mirrored in web/src/api.ts)
// ---------------------------------------------------------------------------

export type ColumnChange = { column: string; from: string; to: string };
export type RowChange = { label: string; changes: ColumnChange[] };

export type TablePlan = {
  table: string;
  insert: number;
  update: number;
  unchanged: number;
  /** Matched an existing local row on an insert-only spec: left untouched. */
  skipped: number;
  localOnly: number;
  pruned: number;
  prunable: boolean;
  /** Column → how many rows change it. The "what's updated" summary. */
  changedColumns: Record<string, number>;
  samples: {
    inserts: string[];
    updates: RowChange[];
    localOnly: string[];
  };
};

export type SyncBlocker = { table: string; message: string };

export type SyncUserSummary = {
  id: string;
  email: string;
  name: string;
  role: "selected" | "dependency";
};

export type SyncPlan = {
  applied: boolean;
  pruneRequested: boolean;
  users: SyncUserSummary[];
  tables: TablePlan[];
  totals: {
    insert: number;
    update: number;
    unchanged: number;
    localOnly: number;
    pruned: number;
  };
  blockers: SyncBlocker[];
  warnings: string[];
};

const SAMPLE_ROWS = 8;
const SAMPLE_CHANGES = 4;
/** Postgres caps a statement at 65535 bind parameters. */
const MAX_BIND_PARAMS = 60000;

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value) ?? "";
}

function ids(rows: Row[], prop = "id"): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    const value = row[prop];
    if (typeof value === "string") out.add(value);
  }
  return [...out];
}

/**
 * Stable representation for comparison. Dates become ISO strings (the two
 * drivers hand back distinct Date instances for the same instant) and object
 * keys are sorted, so a jsonb column whose keys came back in a different order
 * does not read as a change.
 */
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonical(source[key]);
    return out;
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(canonical(value)) ?? "null";
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = value instanceof Date ? value.toISOString() : str(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function columnsOf(table: PgTable): Record<string, PgColumn> {
  return getTableColumns(table);
}

function keyOf(spec: Spec, row: Row): string {
  return spec.pkProps.map((prop) => str(row[prop])).join("|");
}

function pkWhere(spec: Spec, rows: Row[]): SQL | undefined {
  if (rows.length === 0) return undefined;
  const cols = columnsOf(spec.table);
  if (spec.pkProps.length === 1) {
    const prop = spec.pkProps[0];
    const values = rows.map((row) => row[prop]).filter((v) => v !== null);
    if (values.length === 0) return undefined;
    return inArray(cols[prop], values as string[]);
  }
  return or(
    ...rows.map((row) =>
      and(...spec.pkProps.map((prop) => eq(cols[prop], row[prop] as string))),
    ),
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Table specs — INSERT ORDER. Prune walks this list backwards.
// ---------------------------------------------------------------------------

const userLabel = (names: NameMaps, id: unknown): string =>
  names.user.get(str(id)) ?? str(id).slice(0, 8);

const SPECS: Spec[] = [
  {
    key: "users",
    table: users,
    pkProps: ["id"],
    // Email is NOT a natural key: two accounts with one address are two
    // different people, and merging them is not a sync. It is a blocker.
    label: (row) => str(row.email),
    prunable: false,
  },
  {
    key: "accounts",
    table: accounts,
    pkProps: ["id"],
    naturalKeys: (row) => [`${str(row.providerId)}|${str(row.accountId)}`],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.providerId)}`,
    prunable: true,
    scopeWhere: (ctx) => inArray(accounts.userId, ctx.primaryIds),
  },
  {
    key: "user_profiles",
    table: userProfiles,
    pkProps: ["id"],
    // 1:1 with the user and the id is server-generated, so the local surrogate
    // is kept and its contents updated — the alternative is a guaranteed
    // user_profiles_user_id_uq violation on every re-sync.
    naturalKeys: (row) => [str(row.userId)],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.goal)} · ${str(row.planId)}`,
    prunable: true,
    scopeWhere: (ctx) => inArray(userProfiles.userId, ctx.primaryIds),
  },
  {
    key: "foods (referenced)",
    table: foods,
    pkProps: ["id"],
    naturalKeys: sourceRefKey,
    label: (row) => foodLabel(row),
    insertOnly: true,
    prunable: false,
    candidateWhere: (ctx) =>
      ctx.sourceRefs.length
        ? and(inArray(foods.sourceRef, ctx.sourceRefs), isNull(foods.deletedAt))
        : undefined,
    foodRefProps: ["forkedFrom"],
    userRefs: (row) => [row.ownerId as string | null, row.reviewedBy as string | null],
  },
  {
    key: "foods (owned)",
    table: foods,
    pkProps: ["id"],
    naturalKeys: sourceRefKey,
    label: (row) => foodLabel(row),
    prunable: true,
    scopeWhere: (ctx) => inArray(foods.ownerId, ctx.primaryIds),
    foodRefProps: ["forkedFrom"],
    userRefs: (row) => [row.reviewedBy as string | null],
  },
  {
    key: "food_portions",
    table: foodPortions,
    pkProps: ["id"],
    label: (row) => `${str(row.label)} · ${str(row.amountInBase)}`,
    prunable: true,
    scopeWhere: (ctx) =>
      ctx.localOwnedFoodIds.length
        ? inArray(foodPortions.foodId, ctx.localOwnedFoodIds)
        : undefined,
    foodRefProps: ["foodId"],
    // The local copy of a remapped food already has its own portions; adding
    // live's would duplicate every one of them.
    dropWhenFoodRemapped: true,
  },
  {
    key: "food_reviews",
    table: foodReviews,
    pkProps: ["id"],
    label: (row) => `${str(row.fromStatus)} → ${str(row.toStatus)}`,
    prunable: true,
    scopeWhere: (ctx) =>
      ctx.localOwnedFoodIds.length
        ? inArray(foodReviews.foodId, ctx.localOwnedFoodIds)
        : undefined,
    foodRefProps: ["foodId"],
    dropWhenFoodRemapped: true,
    userRefs: (row) => [row.reviewerId as string | null],
  },
  {
    key: "food_reports",
    table: foodReports,
    pkProps: ["id"],
    label: (row) => str(row.reason),
    prunable: true,
    scopeWhere: (ctx) =>
      ctx.localOwnedFoodIds.length
        ? inArray(foodReports.foodId, ctx.localOwnedFoodIds)
        : undefined,
    foodRefProps: ["foodId"],
    dropWhenFoodRemapped: true,
    userRefs: (row) => [
      row.reporterId as string | null,
      row.resolvedBy as string | null,
    ],
  },
  {
    key: "groups",
    groupScoped: true,
    table: groups,
    pkProps: ["id"],
    label: (row) => `${str(row.name)} (${str(row.category)})`,
    // Never pruned: a group row cascades to every member's rows, including
    // people who were never part of this sync.
    prunable: false,
    userRefs: (row) => [row.ownerId as string | null],
  },
  {
    key: "group_members",
    groupScoped: true,
    table: groupMembers,
    pkProps: ["id"],
    // Matches group_members_group_user_current_uq: only one LIVE membership per
    // pair, so only live rows have a natural identity. `left`/`removed` rows
    // are history and several may exist for the same pair.
    naturalKeys: (row) =>
      row.status === "active" || row.status === "invited"
        ? [`${str(row.groupId)}|${str(row.userId)}`]
        : [],
    label: (row, names) =>
      `${names.group.get(str(row.groupId)) ?? "group"} · ${userLabel(names, row.userId)} · ${str(row.role)}/${str(row.status)}`,
    prunable: true,
    // Only the selected users' OWN memberships. Someone else's row in a shared
    // group is not this sync's business, and deleting it would quietly shrink
    // that group for every other local account.
    scopeWhere: (ctx) =>
      ctx.groupIds.length
        ? and(
            inArray(groupMembers.groupId, ctx.groupIds),
            inArray(groupMembers.userId, ctx.primaryIds),
          )
        : undefined,
    candidateWhere: (ctx) =>
      ctx.groupIds.length ? inArray(groupMembers.groupId, ctx.groupIds) : undefined,
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "group_invites",
    groupScoped: true,
    table: groupInvites,
    pkProps: ["id"],
    naturalKeys: (row) => {
      const keys = [`tok:${str(row.token)}`];
      // group_invites_group_invited_user_uq — one live direct invitation per
      // person per group, and the predicate cannot mention expires_at.
      if (
        row.kind === "direct" &&
        row.revokedAt === null &&
        row.declinedAt === null &&
        row.useCount === 0
      ) {
        keys.push(`dir:${str(row.groupId)}|${str(row.invitedUserId)}`);
      }
      return keys;
    },
    label: (row, names) =>
      `${names.group.get(str(row.groupId)) ?? "group"} · ${str(row.kind)} → ${str(row.invitedEmail) || "link"}`,
    prunable: true,
    scopeWhere: (ctx) =>
      ctx.groupIds.length
        ? and(
            inArray(groupInvites.groupId, ctx.groupIds),
            inArray(groupInvites.createdBy, ctx.primaryIds),
          )
        : undefined,
    candidateWhere: (ctx) =>
      ctx.groupIds.length ? inArray(groupInvites.groupId, ctx.groupIds) : undefined,
    userRefs: (row) => [
      row.createdBy as string | null,
      row.invitedUserId as string | null,
    ],
  },
  {
    key: "group_join_requests",
    groupScoped: true,
    table: groupJoinRequests,
    pkProps: ["id"],
    naturalKeys: (row) =>
      row.status === "pending"
        ? [`${str(row.groupId)}|${str(row.userId)}`]
        : [],
    label: (row, names) =>
      `${names.group.get(str(row.groupId)) ?? "group"} · ${userLabel(names, row.userId)} · ${str(row.status)}`,
    prunable: true,
    scopeWhere: (ctx) =>
      ctx.groupIds.length
        ? and(
            inArray(groupJoinRequests.groupId, ctx.groupIds),
            inArray(groupJoinRequests.userId, ctx.primaryIds),
          )
        : undefined,
    candidateWhere: (ctx) =>
      ctx.groupIds.length
        ? inArray(groupJoinRequests.groupId, ctx.groupIds)
        : undefined,
    userRefs: (row) => [
      row.userId as string | null,
      row.decidedBy as string | null,
    ],
  },
  {
    key: "diary_entries",
    table: diaryEntries,
    pkProps: ["id"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.entryDate)} ${str(row.meal)} · ${str(row.name)}`,
    prunable: true,
    scopeWhere: (ctx) => inArray(diaryEntries.userId, ctx.primaryIds),
    foodRefProps: ["foodId"],
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "user_targets",
    table: userTargets,
    pkProps: ["id"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · from ${str(row.effectiveFrom)} · ${str(row.energyKcal)} kcal`,
    prunable: true,
    scopeWhere: (ctx) => inArray(userTargets.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null, row.setBy as string | null],
  },
  {
    key: "daily_summaries",
    table: dailySummaries,
    pkProps: ["userId", "entryDate"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.entryDate)} · ${str(row.energyKcal)} kcal`,
    prunable: true,
    scopeWhere: (ctx) => inArray(dailySummaries.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "weight_entries",
    table: weightEntries,
    pkProps: ["id"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.entryDate)} · ${str(row.weightKg)} kg`,
    prunable: true,
    scopeWhere: (ctx) => inArray(weightEntries.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "user_weight_goals",
    table: userWeightGoals,
    pkProps: ["id"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · from ${str(row.effectiveFrom)} → ${str(row.targetWeightKg)} kg`,
    prunable: true,
    scopeWhere: (ctx) => inArray(userWeightGoals.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "water_entries",
    table: waterEntries,
    pkProps: ["id"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.entryDate)} · ${str(row.volumeMl)} ml`,
    prunable: true,
    scopeWhere: (ctx) => inArray(waterEntries.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null],
  },
  {
    // Keyed on user_id, not a surrogate id — one goal row per user, upserted.
    key: "water_goals",
    table: waterGoals,
    pkProps: ["userId"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.dailyGoalMl)} ml/day`,
    prunable: true,
    scopeWhere: (ctx) => inArray(waterGoals.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "fasting_sessions",
    table: fastingSessions,
    pkProps: ["id"],
    label: (row, names) =>
      `${userLabel(names, row.userId)} · ${str(row.startedAt)} · ${str(row.targetHours)}h${
        row.endedAt === null ? " (running)" : ""
      }`,
    prunable: true,
    scopeWhere: (ctx) => inArray(fastingSessions.userId, ctx.primaryIds),
    userRefs: (row) => [row.userId as string | null],
  },
  {
    key: "group_interactions",
    groupScoped: true,
    table: groupInteractions,
    pkProps: ["id"],
    naturalKeys: (row) =>
      row.kind === "reaction" && row.deletedAt === null
        ? [
            `rx:${str(row.groupId)}|${str(row.authorId)}|${str(row.subjectUserId)}|${str(row.subjectDate)}|${str(row.emoji)}`,
          ]
        : [],
    label: (row, names) =>
      `${userLabel(names, row.authorId)} · ${str(row.kind)} on ${str(row.subjectDate)}`,
    prunable: true,
    scopeWhere: (ctx) =>
      ctx.groupIds.length
        ? and(
            inArray(groupInteractions.groupId, ctx.groupIds),
            inArray(groupInteractions.authorId, ctx.primaryIds),
          )
        : undefined,
    candidateWhere: (ctx) =>
      ctx.groupIds.length
        ? inArray(groupInteractions.groupId, ctx.groupIds)
        : undefined,
    userRefs: (row) => [
      row.authorId as string | null,
      row.subjectUserId as string | null,
    ],
  },
];

function foodLabel(row: Row): string {
  const brand = str(row.brand);
  return brand ? `${str(row.name)} · ${brand}` : str(row.name);
}

/**
 * The one identity that survives a separate USDA import on each side. Soft
 * deleted rows are excluded to match foods_source_ref_active_uq — a deleted row
 * is not in that index and so cannot collide.
 */
function sourceRefKey(row: Row): string[] {
  return typeof row.sourceRef === "string" && row.deletedAt === null
    ? [`src:${row.sourceRef}`]
    : [];
}

// ---------------------------------------------------------------------------
// Collection — reads live, writes nothing
// ---------------------------------------------------------------------------

export type Snapshot = {
  /** Spec key → rows, in SPECS order. */
  rows: Map<string, Row[]>;
  primaryIds: string[];
  dependencyUserIds: string[];
  groupIds: string[];
  sourceRefs: string[];
  names: NameMaps;
  warnings: string[];
};

async function loadRows(
  tx: Tx,
  table: PgTable,
  where: SQL | undefined,
): Promise<Row[]> {
  if (!where) return [];
  const rows = await tx.select().from(table).where(where);
  return rows;
}

export async function collect(
  src: Tx,
  opts: { userIds: string[]; includeGroups: boolean },
): Promise<Snapshot> {
  const warnings: string[] = [];

  const selectedUsers = await loadRows(
    src,
    users,
    inArray(users.id, opts.userIds),
  );
  const primaryIds = ids(selectedUsers);
  for (const missing of opts.userIds.filter((id) => !primaryIds.includes(id))) {
    warnings.push(`User ${missing} does not exist on live — skipped.`);
  }
  if (primaryIds.length === 0) {
    return {
      rows: new Map(),
      primaryIds: [],
      dependencyUserIds: [],
      groupIds: [],
      sourceRefs: [],
      names: { user: new Map(), group: new Map() },
      warnings,
    };
  }

  const [
    accountRows,
    profileRows,
    ownedFoods,
    diaryRows,
    targetRows,
    summaryRows,
    weightRows,
    weightGoalRows,
  ] = await Promise.all([
    loadRows(src, accounts, inArray(accounts.userId, primaryIds)),
    loadRows(src, userProfiles, inArray(userProfiles.userId, primaryIds)),
    loadRows(src, foods, inArray(foods.ownerId, primaryIds)),
    loadRows(src, diaryEntries, inArray(diaryEntries.userId, primaryIds)),
    loadRows(src, userTargets, inArray(userTargets.userId, primaryIds)),
    loadRows(src, dailySummaries, inArray(dailySummaries.userId, primaryIds)),
    loadRows(src, weightEntries, inArray(weightEntries.userId, primaryIds)),
    loadRows(src, userWeightGoals, inArray(userWeightGoals.userId, primaryIds)),
  ]);

  // Groups: the whole group, every member — a group synced with one member in
  // it is a lie about what that account belongs to.
  let groupIds: string[] = [];
  if (opts.includeGroups) {
    const [memberships, owned] = await Promise.all([
      src
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(inArray(groupMembers.userId, primaryIds)),
      src
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.ownerId, primaryIds)),
    ]);
    groupIds = [
      ...new Set([...memberships.map((r) => r.groupId), ...owned.map((r) => r.id)]),
    ];
  }
  const inGroups = groupIds.length > 0;
  const [groupRows, memberRows, inviteRows, joinRequestRows, interactionRows] =
    await Promise.all([
      loadRows(src, groups, inGroups ? inArray(groups.id, groupIds) : undefined),
      loadRows(
        src,
        groupMembers,
        inGroups ? inArray(groupMembers.groupId, groupIds) : undefined,
      ),
      loadRows(
        src,
        groupInvites,
        inGroups ? inArray(groupInvites.groupId, groupIds) : undefined,
      ),
      loadRows(
        src,
        groupJoinRequests,
        inGroups ? inArray(groupJoinRequests.groupId, groupIds) : undefined,
      ),
      loadRows(
        src,
        groupInteractions,
        inGroups ? inArray(groupInteractions.groupId, groupIds) : undefined,
      ),
    ]);

  // Foods the diary points at that the selected users don't own: system rows
  // and other people's. Pulled so diary_entries.food_id has something to point
  // at — they are inserted only if missing, never updated.
  const ownedFoodIds = new Set(ids(ownedFoods));
  const referencedFoods: Row[] = [];
  const seen = new Set<string>();
  let frontier = [
    ...diaryRows.map((row) => row.foodId),
    ...ownedFoods.map((row) => row.forkedFrom),
  ].filter((id): id is string => typeof id === "string" && !ownedFoodIds.has(id));
  while (frontier.length > 0) {
    const batch = frontier.filter((id) => !seen.has(id) && !ownedFoodIds.has(id));
    if (batch.length === 0) break;
    for (const id of batch) seen.add(id);
    const rows = await loadRows(src, foods, inArray(foods.id, batch));
    referencedFoods.push(...rows);
    frontier = rows
      .map((row) => row.forkedFrom)
      .filter((id): id is string => typeof id === "string");
  }

  const allFoodIds = [...ownedFoodIds, ...ids(referencedFoods)];
  const [portionRows, reviewRows, reportRows] = await Promise.all([
    loadRows(
      src,
      foodPortions,
      allFoodIds.length ? inArray(foodPortions.foodId, allFoodIds) : undefined,
    ),
    // Moderation history for the user's OWN foods only. A system food's review
    // trail belongs to whoever reviews on that database.
    loadRows(
      src,
      foodReviews,
      ownedFoodIds.size ? inArray(foodReviews.foodId, [...ownedFoodIds]) : undefined,
    ),
    loadRows(
      src,
      foodReports,
      ownedFoodIds.size ? inArray(foodReports.foodId, [...ownedFoodIds]) : undefined,
    ),
  ]);

  const rows = new Map<string, Row[]>([
    ["users", selectedUsers],
    ["accounts", accountRows],
    ["user_profiles", profileRows],
    ["foods (referenced)", referencedFoods],
    ["foods (owned)", ownedFoods],
    ["food_portions", portionRows],
    ["food_reviews", reviewRows],
    ["food_reports", reportRows],
    ["groups", groupRows],
    ["group_members", memberRows],
    ["group_invites", inviteRows],
    ["group_join_requests", joinRequestRows],
    ["diary_entries", diaryRows],
    ["user_targets", targetRows],
    ["daily_summaries", summaryRows],
    ["weight_entries", weightRows],
    ["user_weight_goals", weightGoalRows],
    ["group_interactions", interactionRows],
  ]);

  // Dependency users: anybody referenced by a collected row. Their `users` row
  // is pulled so the FK holds — and nothing else, so a co-member arrives as an
  // identity with no diary, weight or targets of their own.
  const referencedUserIds = new Set<string>();
  for (const spec of SPECS) {
    if (!spec.userRefs) continue;
    for (const row of rows.get(spec.key) ?? []) {
      for (const id of spec.userRefs(row)) {
        if (typeof id === "string" && !primaryIds.includes(id)) {
          referencedUserIds.add(id);
        }
      }
    }
  }
  const dependencyUsers = referencedUserIds.size
    ? await loadRows(src, users, inArray(users.id, [...referencedUserIds]))
    : [];
  const dependencyUserIds = ids(dependencyUsers);
  for (const id of referencedUserIds) {
    if (!dependencyUserIds.includes(id)) {
      warnings.push(`Referenced user ${id} was not found on live.`);
    }
  }
  rows.set("users", [...selectedUsers, ...dependencyUsers]);

  const names: NameMaps = {
    user: new Map(
      [...selectedUsers, ...dependencyUsers].map((row) => [
        str(row.id),
        str(row.email),
      ]),
    ),
    group: new Map(groupRows.map((row) => [str(row.id), str(row.name)])),
  };

  const sourceRefs = [
    ...new Set(
      [...referencedFoods, ...ownedFoods]
        .map((row) => row.sourceRef)
        .filter((ref): ref is string => typeof ref === "string"),
    ),
  ];

  return {
    rows,
    primaryIds,
    dependencyUserIds,
    groupIds,
    sourceRefs,
    names,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Diff + write — the local side
// ---------------------------------------------------------------------------

type TableDiff = {
  spec: Spec;
  insert: Row[];
  update: Row[];
  unchanged: number;
  skipped: number;
  localOnly: Row[];
  changedColumns: Record<string, number>;
  updateSamples: RowChange[];
};

async function buildCtx(tx: Tx, snapshot: Snapshot): Promise<Ctx> {
  const primaryIds = snapshot.primaryIds;
  const localOwned = await loadRows(
    tx,
    foods,
    inArray(foods.ownerId, primaryIds),
  );

  // Groups the primaries touch on EITHER side. A group that only exists
  // locally still needs its scope covered, or a stale local membership in it
  // would never be reported.
  const [localMemberships, localOwnedGroups] = await Promise.all([
    tx
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(inArray(groupMembers.userId, primaryIds)),
    tx
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.ownerId, primaryIds)),
  ]);
  const groupIds = [
    ...new Set([
      ...snapshot.groupIds,
      ...localMemberships.map((r) => r.groupId),
      ...localOwnedGroups.map((r) => r.id),
    ]),
  ];

  return {
    primaryIds,
    allUserIds: ids(snapshot.rows.get("users") ?? []),
    groupIds,
    localOwnedFoodIds: ids(localOwned),
    sourceRefs: snapshot.sourceRefs,
    names: snapshot.names,
  };
}

/** Rewrites food FKs onto the local ids discovered while diffing the foods specs. */
function applyFoodRemap(spec: Spec, rows: Row[], remap: Map<string, string>): Row[] {
  if (!spec.foodRefProps || remap.size === 0) return rows;
  const out: Row[] = [];
  for (const row of rows) {
    let next = row;
    let dropped = false;
    for (const prop of spec.foodRefProps) {
      const current = row[prop];
      if (typeof current !== "string") continue;
      const local = remap.get(current);
      if (!local || local === current) continue;
      if (spec.dropWhenFoodRemapped) {
        dropped = true;
        break;
      }
      next = { ...next, [prop]: local };
    }
    if (!dropped) out.push(next);
  }
  return out;
}

async function diffTable(
  tx: Tx,
  spec: Spec,
  sourceRows: Row[],
  ctx: Ctx,
  remap: Map<string, string>,
): Promise<TableDiff> {
  const cols = columnsOf(spec.table);
  const rows = applyFoodRemap(spec, sourceRows, remap);

  // Two reads rather than one OR'd query: the second defines "in scope" in SQL
  // only, so there is no JS copy of the predicate to drift from it.
  const candidateFilters = [pkWhere(spec, rows), spec.candidateWhere?.(ctx)].filter(
    (part): part is SQL => part !== undefined,
  );
  const [candidates, scoped] = await Promise.all([
    loadRows(
      tx,
      spec.table,
      candidateFilters.length ? or(...candidateFilters) : undefined,
    ),
    loadRows(tx, spec.table, spec.scopeWhere?.(ctx)),
  ]);

  const localByKey = new Map<string, Row>();
  for (const row of [...candidates, ...scoped]) {
    localByKey.set(keyOf(spec, row), row);
  }
  const localByNatural = new Map<string, Row>();
  if (spec.naturalKeys) {
    for (const row of localByKey.values()) {
      for (const key of spec.naturalKeys(row)) {
        if (!localByNatural.has(key)) localByNatural.set(key, row);
      }
    }
  }

  const incomingKeys = new Set(rows.map((row) => keyOf(spec, row)));
  const diff: TableDiff = {
    spec,
    insert: [],
    update: [],
    unchanged: 0,
    skipped: 0,
    localOnly: [],
    changedColumns: {},
    updateSamples: [],
  };
  const matchedLocalKeys = new Set<string>();

  for (const incoming of rows) {
    let row = incoming;
    let local = localByKey.get(keyOf(spec, row));

    if (!local && spec.naturalKeys) {
      for (const key of spec.naturalKeys(row)) {
        const hit = localByNatural.get(key);
        if (!hit) continue;
        // Adopting the local id is only safe when no other incoming row
        // already claims it — two rows upserting onto one key would fail with
        // "ON CONFLICT DO UPDATE cannot affect row a second time".
        if (incomingKeys.has(keyOf(spec, hit))) continue;
        local = hit;
        const from = str(row[spec.pkProps[0]]);
        const to = str(hit[spec.pkProps[0]]);
        row = { ...row };
        for (const prop of spec.pkProps) row[prop] = hit[prop];
        if (spec.table === foods && from !== to) remap.set(from, to);
        break;
      }
    }

    if (!local) {
      diff.insert.push(row);
      continue;
    }
    matchedLocalKeys.add(keyOf(spec, local));

    if (spec.insertOnly) {
      diff.skipped += 1;
      continue;
    }

    const changes: ColumnChange[] = [];
    for (const [prop, col] of Object.entries(cols)) {
      if (fingerprint(row[prop]) === fingerprint(local[prop])) continue;
      changes.push({
        column: col.name,
        from: display(local[prop]),
        to: display(row[prop]),
      });
      diff.changedColumns[col.name] = (diff.changedColumns[col.name] ?? 0) + 1;
    }
    if (changes.length === 0) {
      diff.unchanged += 1;
      continue;
    }
    diff.update.push(row);
    if (diff.updateSamples.length < SAMPLE_ROWS) {
      diff.updateSamples.push({
        label: spec.label(row, ctx.names),
        changes: changes.slice(0, SAMPLE_CHANGES),
      });
    }
  }

  for (const row of scoped) {
    const key = keyOf(spec, row);
    if (!incomingKeys.has(key) && !matchedLocalKeys.has(key)) {
      diff.localOnly.push(row);
    }
  }

  return diff;
}

/**
 * Collisions no amount of ordering fixes, reported instead of thrown. Each one
 * is a local row that owns a unique key the incoming row needs, under a
 * different id — the operator has to decide, because both answers (overwrite
 * the local row, or skip the incoming one) lose information.
 */
async function findBlockers(tx: Tx, diffs: TableDiff[]): Promise<SyncBlocker[]> {
  const blockers: SyncBlocker[] = [];

  const incomingUsers = [
    ...(diffs.find((d) => d.spec.key === "users")?.insert ?? []),
    ...(diffs.find((d) => d.spec.key === "users")?.update ?? []),
  ];
  const emails = incomingUsers
    .map((row) => str(row.email).toLowerCase())
    .filter((email) => email.length > 0);
  if (emails.length > 0) {
    const clashes = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(sql`lower(${users.email})`, emails));
    const byEmail = new Map(
      clashes.map((row) => [row.email.toLowerCase(), row.id]),
    );
    for (const row of incomingUsers) {
      const localId = byEmail.get(str(row.email).toLowerCase());
      if (localId && localId !== str(row.id)) {
        blockers.push({
          table: "users",
          message: `${str(row.email)} already exists locally under a different id (${localId} vs ${str(row.id)}). Two accounts cannot share an address — delete the local user or sync into a fresh database.`,
        });
      }
    }
  }

  // foods_barcode_public_uq is partial on public, non-deleted rows.
  const incomingFoods = diffs
    .filter((d) => d.spec.table === foods)
    .flatMap((d) => [...d.insert, ...d.update])
    .filter(
      (row) =>
        typeof row.barcode === "string" &&
        row.visibility === "public" &&
        row.deletedAt === null,
    );
  if (incomingFoods.length > 0) {
    const barcodes = [...new Set(incomingFoods.map((row) => str(row.barcode)))];
    const clashes = await tx
      .select({ id: foods.id, barcode: foods.barcode, name: foods.name })
      .from(foods)
      .where(
        and(
          inArray(foods.barcode, barcodes),
          eq(foods.visibility, "public"),
          isNull(foods.deletedAt),
        ),
      );
    const byBarcode = new Map(
      clashes.map((row) => [str(row.barcode), { id: row.id, name: row.name }]),
    );
    for (const row of incomingFoods) {
      const local = byBarcode.get(str(row.barcode));
      if (local && local.id !== str(row.id)) {
        blockers.push({
          table: "foods",
          message: `Barcode ${str(row.barcode)} is held locally by a different food ("${local.name}", ${local.id}) than the incoming "${foodLabel(row)}". Delete or unpublish one of them — a barcode is a global key and guessing which record is right is not this tool's call.`,
        });
      }
    }
  }

  return blockers;
}

function upsertSet(spec: Spec): Record<string, SQL> {
  const pk = new Set(spec.pkProps);
  const set: Record<string, SQL> = {};
  for (const [prop, col] of Object.entries(columnsOf(spec.table))) {
    if (pk.has(prop)) continue;
    set[prop] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

async function write(
  tx: Tx,
  diffs: TableDiff[],
  prune: boolean,
): Promise<Map<string, number>> {
  const pruned = new Map<string, number>();

  // Prune FIRST, children-out: a local-only row occupying a partial unique
  // index is exactly what would 23505 the insert meant to replace it.
  if (prune) {
    for (const diff of [...diffs].reverse()) {
      if (!diff.spec.prunable || diff.localOnly.length === 0) continue;
      for (const batch of chunk(diff.localOnly, 500)) {
        const where = pkWhere(diff.spec, batch);
        if (where) await tx.delete(diff.spec.table).where(where);
      }
      pruned.set(diff.spec.key, diff.localOnly.length);
    }
  }

  for (const diff of diffs) {
    const rows = [...diff.insert, ...diff.update];
    if (rows.length === 0) continue;
    const cols = columnsOf(diff.spec.table);
    const size = Math.max(
      1,
      Math.floor(MAX_BIND_PARAMS / Math.max(1, Object.keys(cols).length)),
    );
    const target = diff.spec.pkProps.map((prop) => cols[prop]);
    for (const batch of chunk(rows, size)) {
      const insert = tx.insert(diff.spec.table).values(batch);
      await (diff.spec.insertOnly
        ? insert.onConflictDoNothing()
        : insert.onConflictDoUpdate({
            target,
            set: upsertSet(diff.spec),
          }));
    }
  }

  return pruned;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type SyncOptions = {
  userIds: string[];
  includeGroups: boolean;
  prune: boolean;
  /** false = preview. The local transaction is opened `read only`. */
  apply: boolean;
};

export async function runSync(
  source: Database,
  local: Database,
  opts: SyncOptions,
): Promise<SyncPlan> {
  // Repeatable read so the graph is consistent across the ~20 queries, and
  // `read only` so no code path here can write to the live database.
  const snapshot = await source.transaction(
    (tx) => collect(tx, opts),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );

  const warnings = [...snapshot.warnings];
  let pruned = new Map<string, number>();
  let blockers: SyncBlocker[] = [];
  let diffs: TableDiff[] = [];

  const run = async (tx: Tx): Promise<void> => {
    const ctx = await buildCtx(tx, snapshot);
    const remap = new Map<string, string>();
    diffs = [];
    for (const spec of SPECS) {
      if (spec.groupScoped && !opts.includeGroups) continue;
      diffs.push(
        await diffTable(tx, spec, snapshot.rows.get(spec.key) ?? [], ctx, remap),
      );
    }
    if (remap.size > 0) {
      warnings.push(
        `${remap.size} referenced food(s) already exist locally under a different id (matched on source_ref); diary references were rewritten to the local rows.`,
      );
    }
    blockers = await findBlockers(tx, diffs);
    if (opts.apply && blockers.length === 0) {
      pruned = await write(tx, diffs, opts.prune);
    }
  };

  if (opts.apply) {
    await local.transaction(run);
  } else {
    await local.transaction(run, { accessMode: "read only" });
  }

  const applied = opts.apply && blockers.length === 0;
  const tables: TablePlan[] = diffs.map((diff) => ({
    table: diff.spec.key,
    insert: diff.insert.length,
    update: diff.update.length,
    unchanged: diff.unchanged,
    skipped: diff.skipped,
    localOnly: diff.localOnly.length,
    pruned: pruned.get(diff.spec.key) ?? 0,
    prunable: diff.spec.prunable,
    changedColumns: diff.changedColumns,
    samples: {
      inserts: diff.insert
        .slice(0, SAMPLE_ROWS)
        .map((row) => diff.spec.label(row, snapshot.names)),
      updates: diff.updateSamples,
      localOnly: diff.localOnly
        .slice(0, SAMPLE_ROWS)
        .map((row) => diff.spec.label(row, snapshot.names)),
    },
  }));

  const userRows = snapshot.rows.get("users") ?? [];
  return {
    applied,
    pruneRequested: opts.prune,
    users: userRows.map((row) => ({
      id: str(row.id),
      email: str(row.email),
      name: str(row.name),
      role: snapshot.primaryIds.includes(str(row.id))
        ? ("selected" as const)
        : ("dependency" as const),
    })),
    tables: tables.filter(
      (table) =>
        table.insert + table.update + table.unchanged + table.skipped + table.localOnly >
        0,
    ),
    totals: {
      insert: tables.reduce((sum, t) => sum + t.insert, 0),
      update: tables.reduce((sum, t) => sum + t.update, 0),
      unchanged: tables.reduce((sum, t) => sum + t.unchanged, 0),
      localOnly: tables.reduce((sum, t) => sum + t.localOnly, 0),
      pruned: tables.reduce((sum, t) => sum + t.pruned, 0),
    },
    blockers,
    warnings,
  };
}
