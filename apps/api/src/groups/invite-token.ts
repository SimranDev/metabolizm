import { randomBytes } from "node:crypto";

import type { GroupCategory } from "@metabolizm/shared";

/** Short URL-safe secret for invite links/QR codes (12 base64url chars). */
export function generateInviteToken(): string {
  return randomBytes(9).toString("base64url");
}

export type InviteFacts = {
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
  revokedAt: Date | null;
};

export type InviteRejection = "revoked" | "expired" | "exhausted";

/** Why an invite can't be used right now, or null if it's live. */
export function inviteRejection(
  invite: InviteFacts,
  now: Date = new Date(),
): InviteRejection | null {
  if (invite.revokedAt !== null) return "revoked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return "exhausted";
  }
  return null;
}

export const PARTNER_MAX_MEMBERS = 2;

/** App-layer category caps, enforced at join time. */
export function joinRejection(
  category: GroupCategory,
  activeMemberCount: number,
): "full" | null {
  if (category === "partner" && activeMemberCount >= PARTNER_MAX_MEMBERS) {
    return "full";
  }
  return null;
}
