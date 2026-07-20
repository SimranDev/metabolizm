import type {
  AcceptGroupInviteResponse,
  CreateGroupInteractionResponse,
  CreateGroupInviteResponse,
  CreateGroupResponse,
  GroupFeedResponse,
  GroupInvitePreviewResponse,
  GroupLeaderboardResponse,
  GroupMemberDayResponse,
  GroupRosterResponse,
  GroupsListResponse,
  PutMemberTargetsResponse,
  UpdateMyMembershipResponse,
} from "@metabolizm/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { GroupsReadService } from "./groups.read.service";
import {
  acceptGroupInviteSchema,
  createGroupInteractionSchema,
  createGroupInviteSchema,
  createGroupSchema,
  dateParamSchema,
  groupFeedQuerySchema,
  groupLeaderboardQuerySchema,
  idParamSchema,
  inviteTokenParamSchema,
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
} from "./groups.schemas";
import { GroupsService } from "./groups.service";

@Controller()
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly read: GroupsReadService,
    private readonly caller: CallerContext,
  ) {}

  @Post("groups")
  async createGroup(
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
  ): Promise<CreateGroupResponse> {
    return this.groups.createGroup(this.caller.requireUserId(), body);
  }

  @Get("groups")
  async listGroups(): Promise<GroupsListResponse> {
    return this.read.listMyGroups(this.caller.requireUserId());
  }

  @Delete("groups/:id")
  @HttpCode(204)
  async deleteGroup(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
  ): Promise<void> {
    await this.groups.deleteGroup(this.caller.requireUserId(), id);
  }

  @Post("groups/:id/invites")
  async createInvite(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(createGroupInviteSchema))
    body: CreateGroupInviteInput,
  ): Promise<CreateGroupInviteResponse> {
    return this.groups.createInvite(this.caller.requireUserId(), id, body);
  }

  @Delete("groups/:id/invites/:inviteId")
  @HttpCode(204)
  async revokeInvite(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Param("inviteId", new ZodValidationPipe(idParamSchema)) inviteId: string,
  ): Promise<void> {
    await this.groups.revokeInvite(this.caller.requireUserId(), id, inviteId);
  }

  /** Consent screen — public: the joiner isn't a member yet. */
  @Post("invites/:token/preview")
  @HttpCode(200)
  async previewInvite(
    @Param("token", new ZodValidationPipe(inviteTokenParamSchema)) token: string,
  ): Promise<GroupInvitePreviewResponse> {
    return this.groups.previewInvite(token);
  }

  @Post("invites/:token/accept")
  @HttpCode(200)
  async acceptInvite(
    @Param("token", new ZodValidationPipe(inviteTokenParamSchema)) token: string,
    @Body(new ZodValidationPipe(acceptGroupInviteSchema))
    body: AcceptGroupInviteInput,
  ): Promise<AcceptGroupInviteResponse> {
    return this.groups.acceptInvite(this.caller.requireUserId(), token, body);
  }

  @Get("groups/:id/feed")
  async feed(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Query(new ZodValidationPipe(groupFeedQuerySchema)) query: GroupFeedQuery,
  ): Promise<GroupFeedResponse> {
    return this.read.feed(this.caller.requireUserId(), id, query);
  }

  @Get("groups/:id/leaderboard")
  async leaderboard(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Query(new ZodValidationPipe(groupLeaderboardQuerySchema))
    query: GroupLeaderboardQuery,
  ): Promise<GroupLeaderboardResponse> {
    return this.read.leaderboard(this.caller.requireUserId(), id, query);
  }

  @Get("groups/:id/members/:userId/day/:date")
  async memberDay(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Param("userId", new ZodValidationPipe(idParamSchema)) userId: string,
    @Param("date", new ZodValidationPipe(dateParamSchema)) date: string,
  ): Promise<GroupMemberDayResponse> {
    return this.read.memberDay(this.caller.requireUserId(), id, userId, date);
  }

  @Patch("groups/:id/members/me")
  async updateMyMembership(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateMyMembershipSchema))
    body: UpdateMyMembershipInput,
  ): Promise<UpdateMyMembershipResponse> {
    return this.groups.updateMyMembership(this.caller.requireUserId(), id, body);
  }

  @Post("groups/:id/leave")
  @HttpCode(204)
  async leave(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
  ): Promise<void> {
    await this.groups.leaveGroup(this.caller.requireUserId(), id);
  }

  @Delete("groups/:id/members/:userId")
  @HttpCode(204)
  async removeMember(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Param("userId", new ZodValidationPipe(idParamSchema)) userId: string,
  ): Promise<void> {
    await this.groups.removeMember(this.caller.requireUserId(), id, userId);
  }

  @Post("groups/:id/transfer-ownership")
  @HttpCode(200)
  async transferOwnership(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(transferOwnershipSchema))
    body: TransferOwnershipInput,
  ) {
    return this.groups.transferOwnership(this.caller.requireUserId(), id, body);
  }

  @Post("groups/:id/interactions")
  @HttpCode(200)
  async createInteraction(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(createGroupInteractionSchema))
    body: CreateGroupInteractionInput,
  ): Promise<CreateGroupInteractionResponse> {
    return this.groups.createInteraction(this.caller.requireUserId(), id, body);
  }

  @Get("groups/:id/roster")
  async roster(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
  ): Promise<GroupRosterResponse> {
    return this.read.roster(this.caller.requireUserId(), id);
  }

  @Put("groups/:id/members/:userId/targets")
  async putMemberTargets(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Param("userId", new ZodValidationPipe(idParamSchema)) userId: string,
    @Body(new ZodValidationPipe(putMemberTargetsSchema))
    body: PutMemberTargetsInput,
  ): Promise<PutMemberTargetsResponse> {
    return this.groups.putMemberTargets(
      this.caller.requireUserId(),
      id,
      userId,
      body,
    );
  }
}
