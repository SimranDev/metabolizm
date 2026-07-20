// Groups request schemas live in @metabolizm/shared (the mobile consent
// screen renders the same share defaults); re-exported here so controller
// imports stay local, plus the route-param schemas.
export {
  acceptGroupInviteSchema,
  createGroupInteractionSchema,
  createGroupInviteSchema,
  createGroupSchema,
  groupFeedQuerySchema,
  groupLeaderboardQuerySchema,
  putMemberTargetsSchema,
  transferOwnershipSchema,
  updateMyMembershipSchema,
  type AcceptGroupInviteInput,
  type CreateGroupInput,
  type CreateGroupInteractionInput,
  type CreateGroupInviteInput,
  type GroupFeedQuery,
  type GroupLeaderboardQuery,
  type PutMemberTargetsInput,
  type TransferOwnershipInput,
  type UpdateMyMembershipInput,
} from "@metabolizm/shared";

import { entryDateSchema } from "@metabolizm/shared";
import { z } from "zod";

export const idParamSchema = z.uuid();
export const dateParamSchema = entryDateSchema;
export const inviteTokenParamSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid invite token");
