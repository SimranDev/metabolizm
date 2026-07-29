import {
  dailySummaries,
  groupInteractions,
  groupInvites,
  groupJoinRequests,
  groupMembers,
  groups,
  userTargets,
  users,
} from "@metabolizm/db";
import {
  shareDefaultsFor,
  type AcceptGroupInviteInput,
  type AcceptGroupInviteResponse,
  type CreateGroupInput,
  type CreateGroupInteractionInput,
  type CreateGroupInteractionResponse,
  type CreateGroupInvitationInput,
  type CreateGroupInvitationResponse,
  type CreateGroupInviteInput,
  type CreateGroupResponse,
  type GroupDto,
  type GroupInvitePreviewResponse,
  type GroupInviteDto,
  type GroupInvitationsResponse,
  type GroupJoinRequestsResponse,
  type GroupMembershipDto,
  type GroupShareConfig,
  type InvitationState,
  type MyInvitationsResponse,
  type MyJoinRequestDto,
  type PutMemberTargetsInput,
  type PutMemberTargetsResponse,
  type ReceivedInvitationDto,
  type RequestToJoinInput,
  type RequestToJoinResponse,
  type SentInvitationDto,
  type TransferOwnershipInput,
  type UpdateMyMembershipInput,
} from "@metabolizm/shared";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { isPgError } from "../common/pg-error";
import { DB, type Database } from "../db/db.module";
import { NotificationsService } from "../notifications/notifications.service";
import { SummariesService, type DbExecutor } from "../summaries/summaries.service";
import {
  fullMessage,
  generateInviteToken,
  inviteRejection,
  inviteRejectionMessage,
  joinRejection,
} from "./invite-token";
import { normalizeShareConfig } from "./masking";

export type GroupRow = typeof groups.$inferSelect;
export type MemberRow = typeof groupMembers.$inferSelect;
type InviteRow = typeof groupInvites.$inferSelect;

export function toGroupDto(row: GroupRow): GroupDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMembershipDto(row: MemberRow): GroupMembershipDto {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    shareConfig: normalizeShareConfig(row.shareConfig),
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt ? row.leftAt.toISOString() : null,
  };
}

function toInviteDto(row: InviteRow): GroupInviteDto {
  return {
    id: row.id,
    groupId: row.groupId,
    token: row.token,
    expiresAt: row.expiresAt.toISOString(),
    maxUses: row.maxUses,
    useCount: row.useCount,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    requiresApproval: row.requiresApproval,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * How an invitation resolved, for the sender's list.
 *
 * Ordered by finality rather than by inviteRejection's order: accepted wins
 * over everything because a revoke landing after the join changed nothing.
 */
function invitationState(row: InviteRow, now: Date = new Date()): InvitationState {
  if (row.useCount > 0) return "accepted";
  if (row.declinedAt !== null) return "declined";
  if (row.revokedAt !== null) return "revoked";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

/**
 * The sender's view of an invitation they sent.
 *
 * Built field by field down to the email string: no join to `users`, so the
 * route can't be walked as email → name → avatar. See SentInvitationDto.
 */
function toSentInvitationDto(row: InviteRow): SentInvitationDto {
  return {
    id: row.id,
    email: row.invitedEmail ?? "",
    state: invitationState(row),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toMyJoinRequestDto(
  row: typeof groupJoinRequests.$inferSelect,
  group: GroupRow,
): MyJoinRequestDto {
  return {
    id: row.id,
    group: { id: group.id, name: group.name, category: group.category },
    status: row.status,
    requestedAt: row.createdAt.toISOString(),
  };
}

/** The coach side of a trainer group: dedicated coach role, or its owner. */
export function isCoach(group: GroupRow, membership: MemberRow): boolean {
  return (
    group.category === "trainer" &&
    (membership.role === "coach" || membership.role === "owner")
  );
}

/** A direct invitation lives a week before it needs re-sending. */
const INVITATION_TTL_HOURS = 168;

/**
 * The live-invitation predicate, written once.
 *
 * It must stay character-for-character the same shape as the partial index
 * `group_invites_group_invited_user_uq` it targets — Postgres matches an
 * ON CONFLICT arbiter by proving the predicate implies the index's, and a
 * drifted copy silently stops matching and turns the upsert back into a
 * plain insert that 23505s.
 */
const LIVE_INVITATION_PREDICATE = sql`kind = 'direct' AND revoked_at IS NULL AND declined_at IS NULL AND use_count = 0`;

/** The same rule as a WHERE clause, for counting and listing. */
function livePendingInvitation() {
  return and(
    eq(groupInvites.kind, "direct"),
    isNull(groupInvites.revokedAt),
    isNull(groupInvites.declinedAt),
    eq(groupInvites.useCount, 0),
    gt(groupInvites.expiresAt, new Date()),
  );
}

/** Seniority order for the heir picked when an owner deletes their account. */
const HEIR_RANK: Record<MemberRow["role"], number> = {
  owner: 0,
  admin: 1,
  coach: 2,
  member: 3,
};

/**
 * Who inherits a group whose owner is deleting their account: the most senior
 * active member, oldest membership breaking the tie. Null when nobody is left.
 */
function pickHeir(candidates: MemberRow[]): MemberRow | null {
  let heir: MemberRow | null = null;
  for (const candidate of candidates) {
    if (
      heir === null ||
      HEIR_RANK[candidate.role] < HEIR_RANK[heir.role] ||
      (HEIR_RANK[candidate.role] === HEIR_RANK[heir.role] &&
        candidate.joinedAt < heir.joinedAt)
    ) {
      heir = candidate;
    }
  }
  return heir;
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly summaries: SummariesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The caller's live membership in a live group. Non-members, left/removed
   * members, and deleted/unknown groups all 404 identically — group
   * existence is never revealed to outsiders.
   */
  async requireMembership(
    groupId: string,
    userId: string,
    db: DbExecutor = this.db,
  ): Promise<{ group: GroupRow; membership: MemberRow }> {
    const [row] = await db
      .select({ group: groups, membership: groupMembers })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active"),
          isNull(groups.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException("Group not found");
    return row;
  }

  async createGroup(
    userId: string,
    input: CreateGroupInput,
  ): Promise<CreateGroupResponse> {
    try {
      return await this.db.transaction(async (tx) => {
        const [group] = await tx
          .insert(groups)
          .values({
            id: uuidv7(),
            name: input.name,
            category: input.category,
            ownerId: userId,
          })
          .returning();
        const [membership] = await tx
          .insert(groupMembers)
          .values({
            id: uuidv7(),
            groupId: group.id,
            userId,
            role: "owner",
            shareConfig: shareDefaultsFor(input.category, "owner"),
          })
          .returning();
        return { group: toGroupDto(group), membership: toMembershipDto(membership) };
      });
    } catch (error) {
      // FK violation: the dev-header user doesn't exist.
      if (isPgError(error, "23503")) {
        throw new BadRequestException("Unknown user");
      }
      throw error;
    }
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    const { group } = await this.requireMembership(groupId, userId);
    if (group.ownerId !== userId) {
      throw new ForbiddenException("Only the owner can delete a group");
    }
    await this.db
      .update(groups)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)));
  }

  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const { group, membership } = await this.requireMembership(groupId, userId);
    if (group.ownerId === userId) {
      throw new BadRequestException(
        "Transfer ownership or delete the group before leaving",
      );
    }
    await this.db
      .update(groupMembers)
      .set({ status: "left", leftAt: new Date() })
      .where(
        and(eq(groupMembers.id, membership.id), eq(groupMembers.status, "active")),
      );
  }

  async removeMember(
    callerId: string,
    groupId: string,
    targetUserId: string,
  ): Promise<void> {
    const { group, membership: caller } = await this.requireMembership(
      groupId,
      callerId,
    );
    if (targetUserId === callerId) {
      throw new BadRequestException("Use leave to remove yourself");
    }
    const canManage =
      caller.role === "owner" || caller.role === "admin" || isCoach(group, caller);
    if (!canManage) {
      throw new ForbiddenException("Only owners or admins can remove members");
    }
    const target = await this.activeMember(groupId, targetUserId);
    if (!target) throw new NotFoundException("Member not found");
    if (target.userId === group.ownerId) {
      throw new ForbiddenException("The owner cannot be removed");
    }
    // Admins/coaches can be removed only by the owner.
    if (target.role !== "member" && caller.role !== "owner") {
      throw new ForbiddenException("Only the owner can remove admins");
    }
    await this.db
      .update(groupMembers)
      .set({ status: "removed", leftAt: new Date() })
      .where(
        and(eq(groupMembers.id, target.id), eq(groupMembers.status, "active")),
      );
  }

  async transferOwnership(
    callerId: string,
    groupId: string,
    input: TransferOwnershipInput,
  ): Promise<{ group: GroupDto }> {
    const { group } = await this.requireMembership(groupId, callerId);
    if (group.ownerId !== callerId) {
      throw new ForbiddenException("Only the owner can transfer ownership");
    }
    if (input.userId === callerId) {
      throw new BadRequestException("Already the owner");
    }
    const target = await this.activeMember(groupId, input.userId);
    if (!target) throw new NotFoundException("Member not found");

    const updated = await this.db.transaction(async (tx) => {
      const [g] = await tx
        .update(groups)
        .set({ ownerId: input.userId, updatedAt: new Date() })
        .where(eq(groups.id, groupId))
        .returning();
      await tx
        .update(groupMembers)
        .set({ role: "owner" })
        .where(eq(groupMembers.id, target.id));
      // In trainer groups the outgoing owner keeps coach powers; elsewhere
      // they step down to admin.
      const [caller] = await tx
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, callerId),
            eq(groupMembers.status, "active"),
          ),
        );
      if (caller) {
        await tx
          .update(groupMembers)
          .set({ role: group.category === "trainer" ? "coach" : "admin" })
          .where(eq(groupMembers.id, caller.id));
      }
      return g;
    });
    return { group: toGroupDto(updated) };
  }

  /**
   * Hand off or tear down every group this user owns, so their account row can
   * be deleted. Called by `UsersService.deleteAccount` inside its transaction —
   * `groups.owner_id` is ON DELETE RESTRICT precisely so that a departing owner
   * can never silently orphan a group other people are still using.
   *
   * A group with other active members is transferred to the most senior of them
   * rather than deleted: the leaver's data disappears with their account, but
   * everyone else keeps the group, their own history, and each other. Only a
   * group nobody else is left in is destroyed — hard, not soft, because a
   * soft-deleted row still holds the FK that blocks the account delete.
   */
  async releaseOwnedGroups(tx: DbExecutor, userId: string): Promise<void> {
    const owned = await tx
      .select()
      .from(groups)
      .where(eq(groups.ownerId, userId));

    for (const group of owned) {
      // Already soft-deleted by its owner: nothing to hand over.
      const heir = group.deletedAt
        ? null
        : pickHeir(
            await tx
              .select()
              .from(groupMembers)
              .where(
                and(
                  eq(groupMembers.groupId, group.id),
                  eq(groupMembers.status, "active"),
                  ne(groupMembers.userId, userId),
                ),
              ),
          );

      if (!heir) {
        // Cascades to members, invites and interactions.
        await tx.delete(groups).where(eq(groups.id, group.id));
        continue;
      }

      await tx
        .update(groups)
        .set({ ownerId: heir.userId, updatedAt: new Date() })
        .where(eq(groups.id, group.id));
      await tx
        .update(groupMembers)
        .set({ role: "owner" })
        .where(eq(groupMembers.id, heir.id));
      // The leaver's own membership row goes with their user row (cascade), so
      // there is no outgoing-owner demotion to do here.
    }
  }

  async createInvite(
    callerId: string,
    groupId: string,
    input: CreateGroupInviteInput,
  ): Promise<{ invite: GroupInviteDto }> {
    const { group, membership } = await this.requireMembership(groupId, callerId);
    const allowed =
      membership.role === "owner" ||
      membership.role === "admin" ||
      isCoach(group, membership);
    if (!allowed) {
      throw new ForbiddenException("Only owners, admins, or coaches can invite");
    }
    const [invite] = await this.db
      .insert(groupInvites)
      .values({
        id: uuidv7(),
        groupId,
        createdBy: callerId,
        token: generateInviteToken(),
        expiresAt: new Date(Date.now() + input.ttlHours * 3_600_000),
        maxUses: input.maxUses,
        requiresApproval: input.requiresApproval,
      })
      .returning();
    return { invite: toInviteDto(invite) };
  }

  async revokeInvite(
    callerId: string,
    groupId: string,
    inviteId: string,
  ): Promise<void> {
    const { group, membership } = await this.requireMembership(groupId, callerId);
    const allowed =
      membership.role === "owner" ||
      membership.role === "admin" ||
      isCoach(group, membership);
    if (!allowed) {
      throw new ForbiddenException("Only owners, admins, or coaches can revoke");
    }
    await this.db
      .update(groupInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(groupInvites.id, inviteId),
          eq(groupInvites.groupId, groupId),
          isNull(groupInvites.revokedAt),
        ),
      );
  }

  /** Consent screen: what joining via this token means, before accepting. */
  async previewInvite(token: string): Promise<GroupInvitePreviewResponse> {
    const { invite, group } = await this.loadLiveInvite(this.db, token);
    const [{ value: memberCount }] = await this.db
      .select({ value: count() })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "active")),
      );
    return {
      group: {
        name: group.name,
        category: group.category,
        memberCount,
      },
      shareDefaults: shareDefaultsFor(group.category, "member"),
      requiresApproval: invite.requiresApproval,
    };
  }

  async acceptInvite(
    userId: string,
    token: string,
    input: AcceptGroupInviteInput,
  ): Promise<AcceptGroupInviteResponse> {
    return this.runJoin(userId, input, async (tx) => {
      // Lock the invite row so concurrent accepts serialize on use_count.
      const row = await this.loadLiveInvite(tx, token, { forUpdate: true });
      // Belt to previewInvite's braces: the consent screen already offers
      // Request rather than Join for these, but a client that skipped it must
      // not be able to walk straight past the group's approval.
      if (row.invite.requiresApproval) {
        throw new ConflictException("This group reviews requests to join");
      }
      return row;
    });
  }

  /**
   * Accept an invitation addressed to me.
   *
   * The token never travels for a direct invitation, so this is the only way
   * one is redeemed: by id, with the caller checked against invited_user_id.
   */
  async acceptInvitation(
    userId: string,
    invitationId: string,
    input: AcceptGroupInviteInput,
  ): Promise<AcceptGroupInviteResponse> {
    return this.runJoin(userId, input, (tx) =>
      this.loadLiveInvitation(tx, invitationId, userId, { forUpdate: true }),
    );
  }

  /**
   * The one join transaction, shared by both accept entry points.
   *
   * `load` is what differs — a bearer token, or an invitation addressed to the
   * caller — and it runs inside the transaction so the row it locks is the row
   * that gets counted.
   */
  private async runJoin(
    userId: string,
    input: AcceptGroupInviteInput,
    load: (tx: DbExecutor) => Promise<{ invite: InviteRow; group: GroupRow }>,
  ): Promise<AcceptGroupInviteResponse> {
    try {
      return await this.db.transaction(async (tx) => {
        const { invite, group } = await load(tx);

        const activeMembers = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(
            and(
              eq(groupMembers.groupId, group.id),
              eq(groupMembers.status, "active"),
            ),
          );
        if (activeMembers.some((m) => m.userId === userId)) {
          throw new ConflictException("Already a member of this group");
        }
        if (joinRejection(group.category, activeMembers.length) === "full") {
          throw new ConflictException(fullMessage(group.category));
        }

        const shareConfig: GroupShareConfig = {
          ...shareDefaultsFor(group.category, "member"),
          ...input.shareConfig,
        };
        const [membership] = await tx
          .insert(groupMembers)
          .values({
            id: uuidv7(),
            groupId: group.id,
            userId,
            role: "member",
            shareConfig,
          })
          .returning();
        await tx
          .update(groupInvites)
          .set({ useCount: sql`${groupInvites.useCount} + 1` })
          .where(eq(groupInvites.id, invite.id));
        return { group: toGroupDto(group), membership: toMembershipDto(membership) };
      });
    } catch (error) {
      // Unique-index race on (group, user): concurrent double-accept.
      if (isPgError(error, "23505")) {
        throw new ConflictException("Already a member of this group");
      }
      // FK violation: the dev-header user doesn't exist.
      if (isPgError(error, "23503")) {
        throw new BadRequestException("Unknown user");
      }
      throw error;
    }
  }

  /**
   * Invite one person by the email they signed up with.
   *
   * Idempotent by construction: an upsert onto the live-invitation index, so
   * re-inviting somebody refreshes the existing invitation instead of minting
   * a second one — which is also exactly what Resend needs, hence no separate
   * route. It has to be an upsert rather than a check-then-insert because the
   * index cannot include expires_at (see the schema comment): an expired row
   * is not live to inviteRejection yet still occupies the index, so an insert
   * would 23505 and that person could never be invited again.
   */
  async createInvitation(
    callerId: string,
    groupId: string,
    input: CreateGroupInvitationInput,
  ): Promise<CreateGroupInvitationResponse> {
    const { group, membership } = await this.requireMembership(groupId, callerId);
    const allowed =
      membership.role === "owner" ||
      membership.role === "admin" ||
      isCoach(group, membership);
    if (!allowed) {
      throw new ForbiddenException("Only owners, admins, or coaches can invite");
    }

    // Case-insensitive: Better Auth stores the address as the user typed it.
    const [invitee] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);
    if (!invitee) {
      throw new NotFoundException("No Metabolizm account uses that email");
    }
    const [inviter] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, callerId))
      .limit(1);
    const inviterName = inviter?.name ?? "Someone";
    if (invitee.id === callerId) {
      throw new BadRequestException("You're already in this group");
    }
    if (await this.activeMember(groupId, invitee.id)) {
      throw new ConflictException("They're already in this group");
    }

    // Advisory seat check. The authoritative one is inside the join
    // transaction, but without this the invitee gets a notification, taps
    // Accept, and only then learns the group was full.
    const [{ value: occupied }] = await this.db
      .select({ value: count() })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")),
      );
    const [{ value: pending }] = await this.db
      .select({ value: count() })
      .from(groupInvites)
      .where(and(eq(groupInvites.groupId, groupId), livePendingInvitation()));
    if (joinRejection(group.category, occupied + pending) === "full") {
      throw new ConflictException(fullMessage(group.category));
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3_600_000);
    const [invitation] = await this.db
      .insert(groupInvites)
      .values({
        id: uuidv7(),
        groupId,
        createdBy: callerId,
        kind: "direct",
        token: generateInviteToken(),
        invitedUserId: invitee.id,
        invitedEmail: input.email,
        expiresAt,
        maxUses: 1,
      })
      .onConflictDoUpdate({
        target: [groupInvites.groupId, groupInvites.invitedUserId],
        targetWhere: LIVE_INVITATION_PREDICATE,
        set: { expiresAt, createdBy: callerId, invitedEmail: input.email },
      })
      .returning();

    // After the write, and unawaited. Inside a transaction a rollback would
    // still have fired the push; awaited, a slow or failing Expo request would
    // turn a successful invitation into an error the sender sees. Resending
    // notifies again on purpose — that is what Resend is for.
    void this.notifications.sendToUser(invitee.id, {
      // Only a person's name and a group's name. See PushPayload: a push never
      // passes through masking.ts, so nothing gated by a share config, and no
      // number of any kind, may appear here.
      title: `${inviterName} invited you`,
      body: `Join ${group.name} on Metabolizm`,
      data: { kind: "group_invitation", invitationId: invitation.id },
    });

    return { invitation: toSentInvitationDto(invitation) };
  }

  /**
   * Invitations waiting for me.
   *
   * Lives here rather than in GroupsReadService because it reads no member
   * data: an invitation carries the group's name, its size, and the sender's
   * name, all of which the sender disclosed by inviting. There is nothing for
   * masking.ts to gate, which is exactly why it must never grow a field that
   * would need it.
   */
  async listMyInvitations(userId: string): Promise<MyInvitationsResponse> {
    const rows = await this.db
      .select({
        invite: groupInvites,
        group: groups,
        inviterName: users.name,
        inviterImage: users.image,
      })
      .from(groupInvites)
      .innerJoin(groups, eq(groupInvites.groupId, groups.id))
      .innerJoin(users, eq(groupInvites.createdBy, users.id))
      .where(
        and(
          eq(groupInvites.invitedUserId, userId),
          // A soft-deleted group must not sit in an inbox forever: the name
          // would still render and Accept would 404.
          isNull(groups.deletedAt),
          livePendingInvitation(),
        ),
      )
      .orderBy(asc(groupInvites.createdAt));

    // My own open requests ride along: both are "waiting on a decision" and
    // the tab has to show them together, so two round trips would let it
    // render one and not the other.
    const requestRows = await this.db
      .select({ request: groupJoinRequests, group: groups })
      .from(groupJoinRequests)
      .innerJoin(groups, eq(groupJoinRequests.groupId, groups.id))
      .where(
        and(
          eq(groupJoinRequests.userId, userId),
          eq(groupJoinRequests.status, "pending"),
          isNull(groups.deletedAt),
        ),
      )
      .orderBy(asc(groupJoinRequests.createdAt));
    const requests = requestRows.map((r) =>
      toMyJoinRequestDto(r.request, r.group),
    );

    if (rows.length === 0) return { invitations: [], requests };

    // One pass over the members of every invited-to group: it gives both the
    // member count each card shows and the "did I already join by link"
    // filter, which would otherwise leave a dead invitation on screen.
    const groupIds = rows.map((r) => r.group.id);
    const members = await this.db
      .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          inArray(groupMembers.groupId, groupIds),
          eq(groupMembers.status, "active"),
        ),
      );
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    for (const m of members) {
      counts.set(m.groupId, (counts.get(m.groupId) ?? 0) + 1);
      if (m.userId === userId) mine.add(m.groupId);
    }

    return {
      requests,
      invitations: rows
        .filter((r) => !mine.has(r.group.id))
        .map((r) => ({
          id: r.invite.id,
          group: {
            id: r.group.id,
            name: r.group.name,
            category: r.group.category,
            memberCount: counts.get(r.group.id) ?? 0,
          },
          invitedBy: { name: r.inviterName, image: r.inviterImage },
          shareDefaults: shareDefaultsFor(r.group.category, "member"),
          expiresAt: r.invite.expiresAt.toISOString(),
          createdAt: r.invite.createdAt.toISOString(),
        })),
    };
  }

  /** One invitation addressed to me — the consent screen's data source. */
  async getMyInvitation(
    userId: string,
    invitationId: string,
  ): Promise<{ invitation: ReceivedInvitationDto }> {
    // Authorizes first: a stranger gets "not found", never a group name.
    await this.loadLiveInvitation(this.db, invitationId, userId);
    const { invitations } = await this.listMyInvitations(userId);
    const invitation = invitations.find((i) => i.id === invitationId);
    if (!invitation) throw new NotFoundException("Invitation not found");
    return { invitation };
  }

  /** Invitations this group has sent, for the owner/admin/coach who sent them. */
  async listGroupInvitations(
    callerId: string,
    groupId: string,
  ): Promise<GroupInvitationsResponse> {
    const { group, membership } = await this.requireMembership(groupId, callerId);
    const allowed =
      membership.role === "owner" ||
      membership.role === "admin" ||
      isCoach(group, membership);
    if (!allowed) {
      throw new ForbiddenException(
        "Only owners, admins, or coaches can see invitations",
      );
    }
    const rows = await this.db
      .select()
      .from(groupInvites)
      .where(
        and(eq(groupInvites.groupId, groupId), eq(groupInvites.kind, "direct")),
      )
      .orderBy(desc(groupInvites.createdAt))
      .limit(100);
    return { invitations: rows.map(toSentInvitationDto) };
  }

  /**
   * Ask to join through an approval-gated link.
   *
   * The inverse of an invitation: the joiner authors it, the group decides.
   * Nothing is shared and no membership exists until somebody approves.
   */
  async requestToJoin(
    userId: string,
    token: string,
    input: RequestToJoinInput,
  ): Promise<RequestToJoinResponse> {
    const { invite, group } = await this.loadLiveInvite(this.db, token);
    if (!invite.requiresApproval) {
      throw new ConflictException("This invite can be accepted directly");
    }
    if (await this.activeMember(group.id, userId)) {
      throw new ConflictException("Already a member of this group");
    }

    try {
      const [request] = await this.db
        .insert(groupJoinRequests)
        .values({
          id: uuidv7(),
          groupId: group.id,
          userId,
          inviteId: invite.id,
          shareConfig: input.shareConfig ?? {},
        })
        .returning();

      void this.notifyApprovers(group, userId, request.id);
      return { request: toMyJoinRequestDto(request, group) };
    } catch (error) {
      // The partial unique index: one open request per person per group.
      if (isPgError(error, "23505")) {
        throw new ConflictException("You've already asked to join this group");
      }
      throw error;
    }
  }

  /** Open requests, for whoever can decide them. */
  async listJoinRequests(
    callerId: string,
    groupId: string,
  ): Promise<GroupJoinRequestsResponse> {
    const { group } = await this.requireApprover(callerId, groupId);
    const rows = await this.db
      .select({
        request: groupJoinRequests,
        name: users.name,
        image: users.image,
      })
      .from(groupJoinRequests)
      .innerJoin(users, eq(groupJoinRequests.userId, users.id))
      .where(
        and(
          eq(groupJoinRequests.groupId, groupId),
          eq(groupJoinRequests.status, "pending"),
        ),
      )
      .orderBy(asc(groupJoinRequests.createdAt));
    return {
      // Allowlist-built, not the row: identity and the sharing being proposed,
      // and nothing else. See GroupJoinRequestDto.
      requests: rows.map((r) => ({
        id: r.request.id,
        userId: r.request.userId,
        name: r.name,
        image: r.image,
        // Resolved the SAME way approval resolves it — defaults, then their
        // overrides. The stored blob is a partial patch, so normalizing it
        // alone reads as "shares nothing" for someone who only switched one
        // toggle off, and the approver would be shown the wrong answer to the
        // only question this screen asks.
        shareConfig: {
          ...shareDefaultsFor(group.category, "member"),
          ...r.request.shareConfig,
        },
        requestedAt: r.request.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Approve a request: the membership is created here, from the config the
   * requester chose when they asked.
   */
  async approveJoinRequest(
    callerId: string,
    groupId: string,
    requestId: string,
  ): Promise<AcceptGroupInviteResponse> {
    const { group } = await this.requireApprover(callerId, groupId);

    const result = await this.db.transaction(async (tx) => {
      // Lock the request so two admins approving at once can't both insert.
      const [request] = await tx
        .select()
        .from(groupJoinRequests)
        .where(
          and(
            eq(groupJoinRequests.id, requestId),
            eq(groupJoinRequests.groupId, groupId),
            eq(groupJoinRequests.status, "pending"),
          ),
        )
        .for("update");
      if (!request) throw new NotFoundException("Request not found");

      const activeMembers = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.status, "active"),
          ),
        );
      if (activeMembers.some((m) => m.userId === request.userId)) {
        throw new ConflictException("Already a member of this group");
      }
      if (joinRejection(group.category, activeMembers.length) === "full") {
        throw new ConflictException(fullMessage(group.category));
      }

      // The snapshot is a proposal, applied here exactly as acceptInvite
      // applies a live override: category defaults, then what they chose.
      const shareConfig: GroupShareConfig = {
        ...shareDefaultsFor(group.category, "member"),
        ...request.shareConfig,
      };
      const [membership] = await tx
        .insert(groupMembers)
        .values({
          id: uuidv7(),
          groupId,
          userId: request.userId,
          role: "member",
          shareConfig,
        })
        .returning();
      await tx
        .update(groupJoinRequests)
        .set({ status: "approved", decidedAt: new Date(), decidedBy: callerId })
        .where(eq(groupJoinRequests.id, request.id));
      return { membership, requesterId: request.userId };
    });

    void this.notifications.sendToUser(result.requesterId, {
      title: `You're in ${group.name}`,
      body: "Your request to join was approved",
      data: { kind: "group_request_approved", groupId },
    });

    return {
      group: toGroupDto(group),
      membership: toMembershipDto(result.membership),
    };
  }

  /** Decline a request. No notification: a silent no is kinder than a ping. */
  async declineJoinRequest(
    callerId: string,
    groupId: string,
    requestId: string,
  ): Promise<void> {
    await this.requireApprover(callerId, groupId);
    const updated = await this.db
      .update(groupJoinRequests)
      .set({ status: "declined", decidedAt: new Date(), decidedBy: callerId })
      .where(
        and(
          eq(groupJoinRequests.id, requestId),
          eq(groupJoinRequests.groupId, groupId),
          eq(groupJoinRequests.status, "pending"),
        ),
      )
      .returning({ id: groupJoinRequests.id });
    if (updated.length === 0) throw new NotFoundException("Request not found");
  }

  /** Withdraw my own request. Scoped to the author, so only they can. */
  async cancelJoinRequest(userId: string, requestId: string): Promise<void> {
    const updated = await this.db
      .update(groupJoinRequests)
      .set({ status: "cancelled", decidedAt: new Date() })
      .where(
        and(
          eq(groupJoinRequests.id, requestId),
          eq(groupJoinRequests.userId, userId),
          eq(groupJoinRequests.status, "pending"),
        ),
      )
      .returning({ id: groupJoinRequests.id });
    if (updated.length === 0) throw new NotFoundException("Request not found");
  }

  /**
   * The caller's membership when they can decide requests, else 403 — or the
   * usual 404 when they aren't in the group at all.
   */
  private async requireApprover(
    callerId: string,
    groupId: string,
  ): Promise<{ group: GroupRow; membership: MemberRow }> {
    const row = await this.requireMembership(groupId, callerId);
    const allowed =
      row.membership.role === "owner" ||
      row.membership.role === "admin" ||
      isCoach(row.group, row.membership);
    if (!allowed) {
      throw new ForbiddenException(
        "Only owners, admins, or coaches can decide requests",
      );
    }
    return row;
  }

  /** Tell everyone who can act on it. Names only — see PushPayload. */
  private async notifyApprovers(
    group: GroupRow,
    requesterId: string,
    requestId: string,
  ): Promise<void> {
    try {
      const [requester] = await this.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, requesterId))
        .limit(1);
      const approvers = await this.db
        .select({ userId: groupMembers.userId, role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.status, "active"),
          ),
        );
      const payload = {
        title: `${requester?.name ?? "Someone"} wants to join`,
        body: group.name,
        data: { kind: "group_join_request" as const, groupId: group.id, requestId },
      };
      await Promise.all(
        approvers
          .filter(
            (m) =>
              m.role === "owner" ||
              m.role === "admin" ||
              (group.category === "trainer" && m.role === "coach"),
          )
          .map((m) => this.notifications.sendToUser(m.userId, payload)),
      );
    } catch {
      // Same contract as every other send: a notification is an extra.
    }
  }

  /** Decline an invitation addressed to me. Distinct from the sender revoking. */
  async declineInvitation(userId: string, invitationId: string): Promise<void> {
    await this.loadLiveInvitation(this.db, invitationId, userId);
    await this.db
      .update(groupInvites)
      .set({ declinedAt: new Date() })
      .where(
        and(
          eq(groupInvites.id, invitationId),
          eq(groupInvites.invitedUserId, userId),
          isNull(groupInvites.declinedAt),
        ),
      );
  }

  async updateMyMembership(
    userId: string,
    groupId: string,
    input: UpdateMyMembershipInput,
  ): Promise<{ membership: GroupMembershipDto }> {
    const { membership } = await this.requireMembership(groupId, userId);
    const set: Partial<typeof groupMembers.$inferInsert> = {};
    if (input.shareConfig !== undefined) {
      // Merge onto the current config; effective immediately for all days
      // (read-time masking — there are no consent snapshots to update).
      set.shareConfig = {
        ...normalizeShareConfig(membership.shareConfig),
        ...input.shareConfig,
      };
    }
    if (input.lastSeenAt !== undefined) {
      set.lastSeenAt = new Date(input.lastSeenAt);
    }
    const [updated] = await this.db
      .update(groupMembers)
      .set(set)
      .where(eq(groupMembers.id, membership.id))
      .returning();
    return { membership: toMembershipDto(updated) };
  }

  async createInteraction(
    callerId: string,
    groupId: string,
    input: CreateGroupInteractionInput,
  ): Promise<CreateGroupInteractionResponse> {
    const { group, membership } = await this.requireMembership(groupId, callerId);
    const subject = await this.activeMember(groupId, input.subjectUserId);
    if (!subject) throw new NotFoundException("Member not found");

    if (input.kind === "comment") {
      // Trainer groups: comments are coach-only; reactions stay open to all.
      if (group.category === "trainer" && !isCoach(group, membership)) {
        throw new ForbiddenException(
          "Only the coach can comment in trainer groups",
        );
      }
      const [row] = await this.db
        .insert(groupInteractions)
        .values({
          id: uuidv7(),
          groupId,
          authorId: callerId,
          subjectUserId: input.subjectUserId,
          subjectDate: input.subjectDate,
          kind: "comment",
          body: input.body,
        })
        .returning();
      const [author] = await this.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, callerId));
      return {
        comment: {
          id: row.id,
          authorId: row.authorId,
          authorName: author?.name ?? "",
          body: row.body ?? "",
          createdAt: row.createdAt.toISOString(),
        },
      };
    }

    // Reaction toggle: a live identical reaction is removed, otherwise added.
    const emoji = input.emoji ?? "";
    const [existing] = await this.db
      .select()
      .from(groupInteractions)
      .where(
        and(
          eq(groupInteractions.groupId, groupId),
          eq(groupInteractions.authorId, callerId),
          eq(groupInteractions.subjectUserId, input.subjectUserId),
          eq(groupInteractions.subjectDate, input.subjectDate),
          eq(groupInteractions.emoji, emoji),
          eq(groupInteractions.kind, "reaction"),
          isNull(groupInteractions.deletedAt),
        ),
      );
    if (existing) {
      await this.db
        .update(groupInteractions)
        .set({ deletedAt: new Date() })
        .where(eq(groupInteractions.id, existing.id));
      return { reaction: { emoji, reacted: false } };
    }
    try {
      await this.db.insert(groupInteractions).values({
        id: uuidv7(),
        groupId,
        authorId: callerId,
        subjectUserId: input.subjectUserId,
        subjectDate: input.subjectDate,
        kind: "reaction",
        emoji,
      });
    } catch (error) {
      // Double-tap race on the partial unique index: already reacted.
      if (!isPgError(error, "23505")) throw error;
    }
    return { reaction: { emoji, reacted: true } };
  }

  /** Coach writes a client's target; applied directly, recorded via set_by. */
  async putMemberTargets(
    callerId: string,
    groupId: string,
    targetUserId: string,
    input: PutMemberTargetsInput,
  ): Promise<PutMemberTargetsResponse> {
    const { group, membership } = await this.requireMembership(groupId, callerId);
    if (!isCoach(group, membership)) {
      throw new ForbiddenException("Only the coach can set targets");
    }
    const client = await this.activeMember(groupId, targetUserId);
    if (!client) throw new NotFoundException("Member not found");

    return await this.db.transaction(async (tx) => {
      const [target] = await tx
        .insert(userTargets)
        .values({
          id: uuidv7(),
          userId: targetUserId,
          effectiveFrom: input.effectiveFrom,
          energyKcal: input.energyKcal,
          proteinG: input.proteinG,
          carbsG: input.carbsG,
          fatG: input.fatG,
          setBy: callerId,
        })
        .returning();
      // Re-snapshot days ON/AFTER effective_from that already have summaries
      // (usually just today) — days before it keep their old snapshot, so a
      // mid-week change never rewrites past adherence.
      const affected = await tx
        .select({ entryDate: dailySummaries.entryDate })
        .from(dailySummaries)
        .where(
          and(
            eq(dailySummaries.userId, targetUserId),
            gte(dailySummaries.entryDate, input.effectiveFrom),
          ),
        );
      await this.summaries.recomputeDays(
        tx,
        targetUserId,
        affected.map((r) => r.entryDate),
      );
      return {
        target: {
          id: target.id,
          userId: target.userId,
          effectiveFrom: target.effectiveFrom,
          energyKcal: target.energyKcal,
          proteinG: target.proteinG,
          carbsG: target.carbsG,
          fatG: target.fatG,
          setBy: target.setBy,
          createdAt: target.createdAt.toISOString(),
        },
      };
    });
  }

  async activeMember(
    groupId: string,
    userId: string,
  ): Promise<MemberRow | null> {
    const [row] = await this.db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active"),
        ),
      );
    return row ?? null;
  }

  /**
   * Invite + its live group by token. Unknown tokens and deleted groups 404;
   * revoked/expired/exhausted invites 410 so the join screen can say why.
   *
   * Link invites only. A direct invitation's token is never handed out, so a
   * caller presenting one got it some other way — 404 rather than 403, which
   * would confirm the token is real.
   */
  private async loadLiveInvite(
    db: DbExecutor,
    token: string,
    opts: { forUpdate?: boolean } = {},
  ): Promise<{ invite: InviteRow; group: GroupRow }> {
    const query = db
      .select({ invite: groupInvites, group: groups })
      .from(groupInvites)
      .innerJoin(groups, eq(groupInvites.groupId, groups.id))
      .where(
        and(
          eq(groupInvites.token, token),
          eq(groupInvites.kind, "link"),
          isNull(groups.deletedAt),
        ),
      );
    const [row] = opts.forUpdate
      ? await query.for("update", { of: groupInvites })
      : await query;
    if (!row) throw new NotFoundException("Invite not found");
    return this.assertLive(row);
  }

  /**
   * A direct invitation + its live group, by id, for the person it names.
   *
   * The authorization that makes a targeted invitation targeted. Anyone who
   * isn't `invited_user_id` gets the same 404 as an unknown id — matching
   * `requireMembership`, where a non-member can't even learn a group exists.
   */
  private async loadLiveInvitation(
    db: DbExecutor,
    invitationId: string,
    userId: string,
    opts: { forUpdate?: boolean } = {},
  ): Promise<{ invite: InviteRow; group: GroupRow }> {
    const query = db
      .select({ invite: groupInvites, group: groups })
      .from(groupInvites)
      .innerJoin(groups, eq(groupInvites.groupId, groups.id))
      .where(
        and(
          eq(groupInvites.id, invitationId),
          eq(groupInvites.kind, "direct"),
          eq(groupInvites.invitedUserId, userId),
          isNull(groups.deletedAt),
        ),
      );
    const [row] = opts.forUpdate
      ? await query.for("update", { of: groupInvites })
      : await query;
    if (!row) throw new NotFoundException("Invitation not found");
    return this.assertLive(row);
  }

  private assertLive(row: { invite: InviteRow; group: GroupRow }) {
    const rejection = inviteRejection(row.invite);
    if (rejection !== null) {
      throw new GoneException(inviteRejectionMessage(rejection, row.invite.kind));
    }
    return row;
  }
}
