/**
 * Group READ paths. Every payload a member sees about another member is
 * assembled through masking.ts — this service loads facts, masking.ts decides
 * what may be serialized. Loads are scoped to ACTIVE members only, so
 * left/removed members' data never enters a group read at all.
 */
import {
  dailySummaries,
  diaryEntries,
  groupInteractions,
  groupMembers,
  groups,
  users,
} from "@metabolizm/db";
import type {
  GroupFeedQuery,
  GroupFeedResponse,
  GroupLeaderboardQuery,
  GroupLeaderboardResponse,
  GroupListItemDto,
  GroupMemberDayCardDto,
  GroupMemberDayResponse,
  GroupRosterResponse,
  GroupsListResponse,
} from "@metabolizm/shared";
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { DB, type Database } from "../db/db.module";
import type { DaySummaryFacts } from "./adherence";
import { addDays, dateRange, localDateFor, weekStartOf } from "./dates";
import { GroupsService, isCoach, type GroupRow, type MemberRow } from "./groups.service";
import {
  buildLeaderboardEntries,
  buildMemberDayCard,
  buildRosterClient,
  maskDiaryEntries,
  streakFrom,
  weightTrendFrom,
  ROSTER_WINDOW_DAYS,
  STREAK_LOOKBACK_DAYS,
  WEIGHT_TREND_DAYS,
  type CardInteractions,
  type LoggedDayFacts,
  type WeighInFacts,
} from "./masking";

const AVATAR_LIMIT = 5;
const LEADERBOARD_DAYS = 7;

type ActiveMember = {
  userId: string;
  name: string;
  image: string | null;
  timezone: string;
  role: MemberRow["role"];
  shareConfig: unknown;
};

/** Lightweight summary row: enough for streaks and weight trends. */
type LightDay = LoggedDayFacts & WeighInFacts & { userId: string };

@Injectable()
export class GroupsReadService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly groups: GroupsService,
  ) {}

  /** My groups, with avatars, my streak, and unread counts. */
  async listMyGroups(userId: string): Promise<GroupsListResponse> {
    const live = await this.db
      .select({
        groupId: groupMembers.groupId,
        role: groupMembers.role,
        lastSeenAt: groupMembers.lastSeenAt,
        name: groups.name,
        category: groups.category,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active"),
          isNull(groups.deletedAt),
        ),
      )
      .orderBy(asc(groupMembers.joinedAt));
    if (live.length === 0) return { groups: [] };

    const groupIds = live.map((m) => m.groupId);
    const members = await this.db
      .select({
        groupId: groupMembers.groupId,
        userId: groupMembers.userId,
        name: users.name,
        image: users.image,
        joinedAt: groupMembers.joinedAt,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(
        and(
          inArray(groupMembers.groupId, groupIds),
          eq(groupMembers.status, "active"),
        ),
      )
      .orderBy(asc(groupMembers.joinedAt));
    const byGroup = new Map<string, typeof members>();
    for (const m of members) {
      const list = byGroup.get(m.groupId) ?? [];
      list.push(m);
      byGroup.set(m.groupId, list);
    }

    // My own streak — my data, so no masking applies.
    const myTimezone = await this.timezoneOf(userId);
    const today = localDateFor(myTimezone);
    const myStreak = streakFrom(
      await this.lightDays([userId], addDays(today, -STREAK_LOOKBACK_DAYS), today),
      today,
    );

    const items: GroupListItemDto[] = [];
    for (const membership of live) {
      const roster = byGroup.get(membership.groupId) ?? [];
      items.push({
        id: membership.groupId,
        name: membership.name,
        category: membership.category,
        role: membership.role,
        memberCount: roster.length,
        members: roster.slice(0, AVATAR_LIMIT).map((m) => ({
          userId: m.userId,
          name: m.name,
          image: m.image,
        })),
        myStreak,
        unreadCount: await this.unreadCount(
          membership.groupId,
          userId,
          membership.lastSeenAt,
          roster.map((m) => m.userId),
        ),
      });
    }
    return { groups: items };
  }

  /**
   * Per-member day cards. Without an explicit ?date, each member's card is
   * their OWN current local day (per their timezone) — not one global date.
   */
  async feed(
    callerId: string,
    groupId: string,
    query: GroupFeedQuery,
  ): Promise<GroupFeedResponse> {
    const { group } = await this.groups.requireMembership(groupId, callerId);
    const members = await this.activeMembers(groupId);
    const dateFor = (m: ActiveMember): string =>
      query.date ?? localDateFor(m.timezone);

    const cards: GroupMemberDayCardDto[] = [];
    for (const member of members) {
      cards.push(
        await this.buildCard(group, callerId, member, dateFor(member)),
      );
    }
    return { cards };
  }

  /** One member's day, plus their diary entries when they share mealDetail. */
  async memberDay(
    callerId: string,
    groupId: string,
    targetUserId: string,
    date: string,
  ): Promise<GroupMemberDayResponse> {
    const { group } = await this.groups.requireMembership(groupId, callerId);
    const members = await this.activeMembers(groupId);
    const member = members.find((m) => m.userId === targetUserId);
    // Left/removed members and non-members are indistinguishable here.
    if (!member) throw new NotFoundException("Member not found");

    const card = await this.buildCard(group, callerId, member, date);
    const rows = await this.db
      .select({
        id: diaryEntries.id,
        meal: diaryEntries.meal,
        name: diaryEntries.name,
        loggedAt: diaryEntries.loggedAt,
        servingLabel: diaryEntries.servingLabel,
        quantity: diaryEntries.quantity,
        unitLabel: diaryEntries.unitLabel,
        energyKcal: diaryEntries.energyKcal,
        proteinG: diaryEntries.proteinG,
        carbsG: diaryEntries.carbsG,
        fatG: diaryEntries.fatG,
      })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, targetUserId),
          eq(diaryEntries.entryDate, date),
          isNull(diaryEntries.deletedAt),
        ),
      )
      .orderBy(asc(diaryEntries.loggedAt), asc(diaryEntries.id));

    const entries = maskDiaryEntries(rows, member.shareConfig);
    // Key omitted entirely (not null) when mealDetail is off.
    return entries === undefined ? { card } : { card, entries };
  }

  /**
   * Weekly consistency ranking — adherence % vs snapshotted targets and
   * logging streak only. Raw calories and weight are not inputs and do not
   * appear in the response.
   */
  async leaderboard(
    callerId: string,
    groupId: string,
    query: GroupLeaderboardQuery,
  ): Promise<GroupLeaderboardResponse> {
    await this.groups.requireMembership(groupId, callerId);
    const members = await this.activeMembers(groupId);
    const callerTz =
      members.find((m) => m.userId === callerId)?.timezone ?? "UTC";
    const weekStart = weekStartOf(query.week ?? localDateFor(callerTz));
    const week = dateRange(weekStart, LEADERBOARD_DAYS);
    const weekEnd = week[week.length - 1];

    const userIds = members.map((m) => m.userId);
    const summaries = await this.summaryFacts(userIds, weekStart, weekEnd);
    const light = await this.lightDays(
      userIds,
      addDays(weekEnd, -STREAK_LOOKBACK_DAYS),
      weekEnd,
    );

    const entries = buildLeaderboardEntries(
      members.map((member) => {
        const mine =
          summaries.get(member.userId) ?? new Map<string, DaySummaryFacts>();
        return {
          userId: member.userId,
          name: member.name,
          image: member.image,
          rawConfig: member.shareConfig,
          days: week.map((d) => ({ date: d, summary: mine.get(d) ?? null })),
          // Their own today: the rest of the week isn't a miss yet.
          asOf: localDateFor(member.timezone),
          streak: streakFrom(
            light.filter((l) => l.userId === member.userId),
            // Streak is anchored to the week being viewed, so past weeks
            // don't report today's streak.
            weekEnd,
          ),
        };
      }),
    );
    return { weekStart, weekEnd, entries };
  }

  /** Coach-only client roster: 7-day adherence buckets, booleans only. */
  async roster(callerId: string, groupId: string): Promise<GroupRosterResponse> {
    const { group, membership } = await this.groups.requireMembership(
      groupId,
      callerId,
    );
    if (!isCoach(group, membership)) {
      throw new ForbiddenException("Only the coach can view the roster");
    }
    const members = await this.activeMembers(groupId);
    const clients = members.filter((m) => !this.isCoachMember(group, m));
    if (clients.length === 0) return { clients: [] };

    // Each client's window runs in their own timezone.
    const windows = new Map<string, string[]>(
      clients.map((c) => {
        const end = localDateFor(c.timezone);
        return [c.userId, dateRange(addDays(end, -(ROSTER_WINDOW_DAYS - 1)), ROSTER_WINDOW_DAYS)];
      }),
    );
    const allDates = [...windows.values()].flat();
    const summaries = await this.summaryFacts(
      clients.map((c) => c.userId),
      allDates.reduce((min, d) => (d < min ? d : min), allDates[0]),
      allDates.reduce((max, d) => (d > max ? d : max), allDates[0]),
    );

    return {
      clients: clients.map((client) =>
        buildRosterClient({
          userId: client.userId,
          name: client.name,
          image: client.image,
          rawConfig: client.shareConfig,
          dates: windows.get(client.userId) ?? [],
          summariesByDate: summaries.get(client.userId) ?? new Map(),
        }),
      ),
    };
  }

  private isCoachMember(group: GroupRow, member: ActiveMember): boolean {
    return (
      group.category === "trainer" &&
      (member.role === "coach" || member.role === "owner")
    );
  }

  /** Assembles one member's card: facts in, masking.ts decides what's exposed. */
  private async buildCard(
    group: GroupRow,
    callerId: string,
    member: ActiveMember,
    date: string,
  ): Promise<GroupMemberDayCardDto> {
    const summaries = await this.summaryFacts([member.userId], date, date);
    const light = await this.lightDays(
      [member.userId],
      addDays(date, -STREAK_LOOKBACK_DAYS),
      date,
    );
    return buildMemberDayCard(
      {
        userId: member.userId,
        name: member.name,
        image: member.image,
        date,
        summary: summaries.get(member.userId)?.get(date) ?? null,
        weightTrend: weightTrendFrom(
          light.filter((l) => l.entryDate > addDays(date, -WEIGHT_TREND_DAYS)),
          date,
        ),
        streak: streakFrom(light, date),
      },
      member.shareConfig,
      await this.interactionsFor(group.id, callerId, member.userId, date),
    );
  }

  /** Comments and reaction tallies on one member's day card. */
  private async interactionsFor(
    groupId: string,
    callerId: string,
    subjectUserId: string,
    subjectDate: string,
  ): Promise<CardInteractions> {
    const rows = await this.db
      .select({
        id: groupInteractions.id,
        authorId: groupInteractions.authorId,
        authorName: users.name,
        kind: groupInteractions.kind,
        body: groupInteractions.body,
        emoji: groupInteractions.emoji,
        createdAt: groupInteractions.createdAt,
      })
      .from(groupInteractions)
      .innerJoin(users, eq(groupInteractions.authorId, users.id))
      .where(
        and(
          eq(groupInteractions.groupId, groupId),
          eq(groupInteractions.subjectUserId, subjectUserId),
          eq(groupInteractions.subjectDate, subjectDate),
          isNull(groupInteractions.deletedAt),
        ),
      )
      .orderBy(asc(groupInteractions.createdAt));

    const comments = rows
      .filter((r) => r.kind === "comment")
      .map((r) => ({
        id: r.id,
        authorId: r.authorId,
        authorName: r.authorName,
        body: r.body ?? "",
        createdAt: r.createdAt.toISOString(),
      }));
    const tally = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of rows) {
      if (r.kind !== "reaction" || r.emoji === null) continue;
      const current = tally.get(r.emoji) ?? { count: 0, reactedByMe: false };
      current.count += 1;
      if (r.authorId === callerId) current.reactedByMe = true;
      tally.set(r.emoji, current);
    }
    return {
      comments,
      reactions: [...tally.entries()].map(([emoji, t]) => ({ emoji, ...t })),
    };
  }

  private async activeMembers(groupId: string): Promise<ActiveMember[]> {
    return this.db
      .select({
        userId: groupMembers.userId,
        name: users.name,
        image: users.image,
        timezone: users.timezone,
        role: groupMembers.role,
        shareConfig: groupMembers.shareConfig,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")),
      )
      .orderBy(asc(groupMembers.joinedAt));
  }

  /** Full summary rows, keyed userId → date → facts. */
  private async summaryFacts(
    userIds: string[],
    from: string,
    to: string,
  ): Promise<Map<string, Map<string, DaySummaryFacts>>> {
    const out = new Map<string, Map<string, DaySummaryFacts>>();
    if (userIds.length === 0) return out;
    const rows = await this.db
      .select()
      .from(dailySummaries)
      .where(
        and(
          inArray(dailySummaries.userId, userIds),
          gte(dailySummaries.entryDate, from),
          lte(dailySummaries.entryDate, to),
        ),
      );
    for (const row of rows) {
      const byDate = out.get(row.userId) ?? new Map<string, DaySummaryFacts>();
      byDate.set(row.entryDate, {
        entryDate: row.entryDate,
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
      });
      out.set(row.userId, byDate);
    }
    return out;
  }

  /** Streak/weight-trend window: two columns, no jsonb, no nutrition numbers. */
  private async lightDays(
    userIds: string[],
    from: string,
    to: string,
  ): Promise<LightDay[]> {
    if (userIds.length === 0) return [];
    return this.db
      .select({
        userId: dailySummaries.userId,
        entryDate: dailySummaries.entryDate,
        mealsLogged: dailySummaries.mealsLogged,
        weightKg: dailySummaries.weightKg,
      })
      .from(dailySummaries)
      .where(
        and(
          inArray(dailySummaries.userId, userIds),
          gte(dailySummaries.entryDate, from),
          lte(dailySummaries.entryDate, to),
        ),
      );
  }

  /**
   * Activity since my last_seen_at: other members' interactions plus their
   * recomputed days. A never-seen group counts everything.
   */
  private async unreadCount(
    groupId: string,
    userId: string,
    lastSeenAt: Date | null,
    memberIds: string[],
  ): Promise<number> {
    const since = lastSeenAt ?? new Date(0);
    const [interactions] = await this.db
      .select({ value: count() })
      .from(groupInteractions)
      .where(
        and(
          eq(groupInteractions.groupId, groupId),
          isNull(groupInteractions.deletedAt),
          gt(groupInteractions.createdAt, since),
          sql`${groupInteractions.authorId} <> ${userId}`,
        ),
      );
    const others = memberIds.filter((id) => id !== userId);
    if (others.length === 0) return interactions.value;
    const [summaries] = await this.db
      .select({ value: count() })
      .from(dailySummaries)
      .where(
        and(
          inArray(dailySummaries.userId, others),
          gt(dailySummaries.updatedAt, since),
        ),
      );
    return interactions.value + summaries.value;
  }

  private async timezoneOf(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId));
    return row?.timezone ?? "UTC";
  }
}
