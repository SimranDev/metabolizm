/**
 * Query builders shared by the group read paths, kept out of the services so
 * the membership-status gate is stated once and can be asserted directly.
 */
import { groupMembers, users } from "@metabolizm/db";
import { and, asc, eq } from "drizzle-orm";

import type { DbExecutor } from "../summaries/summaries.service";

/**
 * The member rows every group read is scoped to. Status is the privacy gate:
 * a `left` or `removed` member's data must not appear in any other member's
 * feed, member-day, leaderboard, or roster, so both read paths go through
 * this builder instead of re-deriving the filter.
 */
export function activeMembersQuery(db: DbExecutor, groupId: string) {
  return db
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
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.status, "active"),
      ),
    )
    .orderBy(asc(groupMembers.joinedAt));
}
