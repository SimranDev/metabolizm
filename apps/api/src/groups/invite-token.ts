import { randomBytes } from "node:crypto";

import type { GroupCategory } from "@metabolizm/shared";

/** Short URL-safe secret for invite links/QR codes (12 base64url chars). */
export function generateInviteToken(): string {
  return randomBytes(9).toString("base64url");
}

export type InviteKind = "link" | "direct";

export type InviteFacts = {
  kind: InviteKind;
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
  revokedAt: Date | null;
  declinedAt: Date | null;
};

export type InviteRejection =
  | "revoked"
  | "declined"
  | "expired"
  | "exhausted";

/**
 * Why an invite can't be used right now, or null if it's live.
 *
 * Order is the message: `declined` sits above `expired` because a declined
 * invitation goes on ageing out, and "expired" would tell the recipient the
 * clock ran out on a decision they already made.
 */
export function inviteRejection(
  invite: InviteFacts,
  now: Date = new Date(),
): InviteRejection | null {
  if (invite.revokedAt !== null) return "revoked";
  if (invite.declinedAt !== null) return "declined";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return "exhausted";
  }
  return null;
}

/**
 * What to tell the caller, in their own terms.
 *
 * A direct invitation is `maxUses: 1`, so the only way to exhaust one is to
 * have accepted it — reporting that as "exhausted" would be true of the row
 * and useless to the person reading it.
 */
export function inviteRejectionMessage(
  rejection: InviteRejection,
  kind: InviteKind,
): string {
  if (kind === "direct") {
    switch (rejection) {
      case "revoked":
        return "This invitation was withdrawn";
      case "declined":
        return "You already declined this invitation";
      case "expired":
        return "This invitation has expired";
      case "exhausted":
        return "You've already joined this group";
    }
  }
  return `Invite ${rejection}`;
}

export const PARTNER_MAX_MEMBERS = 2;
/** Groups are accountability circles, not audiences. */
export const MAX_GROUP_MEMBERS = 50;

/**
 * App-layer seat caps.
 *
 * `occupied` is active members at accept time, and active members plus live
 * invitations at invite time — checking only the former would let an admin
 * fill a partner group with invitations, and the third person would learn the
 * group was full only after tapping Accept on a notification.
 */
export function joinRejection(
  category: GroupCategory,
  occupied: number,
): "full" | null {
  if (category === "partner" && occupied >= PARTNER_MAX_MEMBERS) return "full";
  if (occupied >= MAX_GROUP_MEMBERS) return "full";
  return null;
}

/** The seat message, which differs because the partner cap has a reason. */
export function fullMessage(category: GroupCategory): string {
  return category === "partner"
    ? `Partner groups are limited to ${PARTNER_MAX_MEMBERS} members`
    : `Groups are limited to ${MAX_GROUP_MEMBERS} members`;
}
