/**
 * Groups endpoints (apps/api groups module).
 *
 * Every response about another member is masked server-side: fields the member
 * doesn't share are ABSENT from the payload, not null. That is why the DTOs
 * mark them optional — presence checks are what drive the "not shared" chips
 * in the UI (see components/groups/not-shared.tsx). Never fill a missing field
 * with a zero or a placeholder value.
 */

import type {
  AcceptGroupInviteResponse,
  CreateGroupInteractionResponse,
  CreateGroupInvitationResponse,
  CreateGroupInviteResponse,
  CreateGroupResponse,
  GroupCategory,
  GroupFeedResponse,
  GroupInteractionKind,
  GroupInvitationsResponse,
  GroupJoinRequestsResponse,
  GroupInvitePreviewResponse,
  GroupLeaderboardResponse,
  GroupMemberDayResponse,
  GroupRosterResponse,
  GroupShareConfigPatch,
  GroupsListResponse,
  MyInvitationsResponse,
  ReceivedInvitationDto,
  RequestToJoinResponse,
  UpdateMyMembershipResponse,
} from "@metabolizm/shared";

import { apiRequest } from "./client";

type Signal = { signal?: AbortSignal };

export function listGroups(opts?: Signal): Promise<GroupsListResponse> {
  return apiRequest("/groups", opts);
}

export function createGroup(
  input: { name: string; category: GroupCategory },
  opts?: Signal,
): Promise<CreateGroupResponse> {
  return apiRequest("/groups", { method: "POST", body: input, ...opts });
}

export function deleteGroup(groupId: string, opts?: Signal): Promise<void> {
  return apiRequest(`/groups/${groupId}`, { method: "DELETE", ...opts });
}

/**
 * Leave a group. Deliberately sends no body — the server takes none, and
 * Fastify 400s on an empty body sent with a JSON content-type.
 */
export function leaveGroup(groupId: string, opts?: Signal): Promise<void> {
  return apiRequest(`/groups/${groupId}/leave`, { method: "POST", ...opts });
}

export function createInvite(
  groupId: string,
  input: {
    ttlHours?: number;
    maxUses?: number | null;
    /** Opening the link asks to join instead of joining outright. */
    requiresApproval?: boolean;
  } = {},
  opts?: Signal,
): Promise<CreateGroupInviteResponse> {
  return apiRequest(`/groups/${groupId}/invites`, {
    method: "POST",
    body: input,
    ...opts,
  });
}

/** Consent screen: the group and the share defaults joining would apply. */
export function previewInvite(
  token: string,
  opts?: Signal,
): Promise<GroupInvitePreviewResponse> {
  return apiRequest(`/invites/${encodeURIComponent(token)}/preview`, {
    method: "POST",
    ...opts,
  });
}

/** `shareConfig` overrides only the toggles the joiner changed on the consent screen. */
export function acceptInvite(
  token: string,
  shareConfig?: GroupShareConfigPatch,
  opts?: Signal,
): Promise<AcceptGroupInviteResponse> {
  return apiRequest(`/invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    body: shareConfig ? { shareConfig } : {},
    ...opts,
  });
}

/** Withdraw an invite the group sent. Bodyless — see `leaveGroup`. */
export function revokeInvite(
  groupId: string,
  inviteId: string,
  opts?: Signal,
): Promise<void> {
  return apiRequest(`/groups/${groupId}/invites/${inviteId}`, {
    method: "DELETE",
    ...opts,
  });
}

/**
 * Invite one person by the email they signed up with.
 *
 * Idempotent server-side: inviting the same address again refreshes the
 * existing invitation rather than minting a second, so this is also Resend.
 * Rejects with 404 when no account uses the address — the caller should show
 * that message rather than pretending it worked.
 */
export function createInvitation(
  groupId: string,
  email: string,
  opts?: Signal,
): Promise<CreateGroupInvitationResponse> {
  return apiRequest(`/groups/${groupId}/invitations`, {
    method: "POST",
    body: { email },
    ...opts,
  });
}

/** Invitations sent by a group I own/admin/coach. */
export function listGroupInvitations(
  groupId: string,
  opts?: Signal,
): Promise<GroupInvitationsResponse> {
  return apiRequest(`/groups/${groupId}/invitations`, opts);
}

/** Invitations waiting for me. */
export function listMyInvitations(
  opts?: Signal,
): Promise<MyInvitationsResponse> {
  return apiRequest("/groups/invitations", opts);
}

/**
 * One invitation addressed to me — the consent screen's data source.
 *
 * Addressed by id, never by token: a direct invitation's token never leaves
 * the server, which is what stops it being forwarded to someone the group
 * didn't choose.
 */
export function getMyInvitation(
  invitationId: string,
  opts?: Signal,
): Promise<{ invitation: ReceivedInvitationDto }> {
  return apiRequest(`/groups/invitations/${invitationId}`, opts);
}

/** `shareConfig` overrides only the toggles changed on the consent screen. */
export function acceptInvitation(
  invitationId: string,
  shareConfig?: GroupShareConfigPatch,
  opts?: Signal,
): Promise<AcceptGroupInviteResponse> {
  return apiRequest(`/groups/invitations/${invitationId}/accept`, {
    method: "POST",
    body: shareConfig ? { shareConfig } : {},
    ...opts,
  });
}

/** Decline an invitation addressed to me. Bodyless — see `leaveGroup`. */
export function declineInvitation(
  invitationId: string,
  opts?: Signal,
): Promise<void> {
  return apiRequest(`/groups/invitations/${invitationId}/decline`, {
    method: "POST",
    ...opts,
  });
}

/**
 * Ask to join through an approval-gated link.
 *
 * The consent screen shows `requiresApproval` from the preview and offers this
 * instead of Accept. Nothing is shared until somebody approves.
 */
export function requestToJoin(
  token: string,
  shareConfig?: GroupShareConfigPatch,
  opts?: Signal,
): Promise<RequestToJoinResponse> {
  return apiRequest(`/invites/${encodeURIComponent(token)}/request`, {
    method: "POST",
    body: shareConfig ? { shareConfig } : {},
    ...opts,
  });
}

/** Open requests for a group I own/admin/coach. */
export function listJoinRequests(
  groupId: string,
  opts?: Signal,
): Promise<GroupJoinRequestsResponse> {
  return apiRequest(`/groups/${groupId}/requests`, opts);
}

export function approveJoinRequest(
  groupId: string,
  requestId: string,
  opts?: Signal,
): Promise<AcceptGroupInviteResponse> {
  return apiRequest(`/groups/${groupId}/requests/${requestId}/approve`, {
    method: "POST",
    ...opts,
  });
}

/** Bodyless — see `leaveGroup`. */
export function declineJoinRequest(
  groupId: string,
  requestId: string,
  opts?: Signal,
): Promise<void> {
  return apiRequest(`/groups/${groupId}/requests/${requestId}/decline`, {
    method: "POST",
    ...opts,
  });
}

/** Withdraw my own request. */
export function cancelJoinRequest(
  requestId: string,
  opts?: Signal,
): Promise<void> {
  return apiRequest(`/groups/requests/${requestId}/cancel`, {
    method: "POST",
    ...opts,
  });
}

/** Omit `date` for "today" — the server resolves each member's own local day. */
export function getFeed(
  groupId: string,
  date?: string,
  opts?: Signal,
): Promise<GroupFeedResponse> {
  const query = date ? `?date=${date}` : "";
  return apiRequest(`/groups/${groupId}/feed${query}`, opts);
}

export function getLeaderboard(
  groupId: string,
  week?: string,
  opts?: Signal,
): Promise<GroupLeaderboardResponse> {
  const query = week ? `?week=${week}` : "";
  return apiRequest(`/groups/${groupId}/leaderboard${query}`, opts);
}

export function getMemberDay(
  groupId: string,
  userId: string,
  date: string,
  opts?: Signal,
): Promise<GroupMemberDayResponse> {
  return apiRequest(`/groups/${groupId}/members/${userId}/day/${date}`, opts);
}

/** Coach-only client roster (trainer groups). */
export function getRoster(
  groupId: string,
  opts?: Signal,
): Promise<GroupRosterResponse> {
  return apiRequest(`/groups/${groupId}/roster`, opts);
}

/**
 * Patch my own membership. Send ONLY the toggles that changed: the server
 * merges the patch onto the stored config, so a full object would overwrite
 * keys the user never touched.
 */
export function updateMyMembership(
  groupId: string,
  input: { shareConfig?: GroupShareConfigPatch; lastSeenAt?: string },
  opts?: Signal,
): Promise<UpdateMyMembershipResponse> {
  return apiRequest(`/groups/${groupId}/members/me`, {
    method: "PATCH",
    body: input,
    ...opts,
  });
}

export function postInteraction(
  groupId: string,
  input: {
    subjectUserId: string;
    subjectDate: string;
    kind: GroupInteractionKind;
    body?: string;
    emoji?: string;
  },
  opts?: Signal,
): Promise<CreateGroupInteractionResponse> {
  return apiRequest(`/groups/${groupId}/interactions`, {
    method: "POST",
    body: input,
    ...opts,
  });
}
