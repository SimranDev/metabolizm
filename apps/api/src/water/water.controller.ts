import type {
  WaterEntriesResponse,
  WaterEntryResponse,
  WaterGoalResponse,
  WaterSummaryResponse,
} from "@metabolizm/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  createWaterEntrySchema,
  putWaterGoalSchema,
  waterEntriesQuerySchema,
  waterEntryIdParamSchema,
  waterSummaryQuerySchema,
  type CreateWaterEntryInput,
  type PutWaterGoalInput,
  type WaterEntriesQuery,
  type WaterSummaryQuery,
} from "./water.schemas";
import { WaterService } from "./water.service";

@Controller("water")
export class WaterController {
  constructor(
    private readonly waterService: WaterService,
    private readonly caller: CallerContext,
  ) {}

  @Post("entries")
  async create(
    @Body(new ZodValidationPipe(createWaterEntrySchema))
    body: CreateWaterEntryInput,
  ): Promise<WaterEntryResponse> {
    return {
      entry: await this.waterService.create(this.caller.requireUserId(), body),
    };
  }

  @Get("entries")
  async listEntries(
    @Query(new ZodValidationPipe(waterEntriesQuerySchema))
    query: WaterEntriesQuery,
  ): Promise<WaterEntriesResponse> {
    return this.waterService.listEntries(this.caller.requireUserId(), query);
  }

  @Delete("entries/:id")
  @HttpCode(204)
  async remove(
    @Param("id", new ZodValidationPipe(waterEntryIdParamSchema)) id: string,
  ): Promise<void> {
    await this.waterService.remove(this.caller.requireUserId(), id);
  }

  @Get("summary")
  async summary(
    @Query(new ZodValidationPipe(waterSummaryQuerySchema))
    query: WaterSummaryQuery,
  ): Promise<WaterSummaryResponse> {
    return this.waterService.summary(this.caller.requireUserId(), query);
  }

  @Get("goal")
  async goal(): Promise<WaterGoalResponse> {
    return { goal: await this.waterService.goalFor(this.caller.requireUserId()) };
  }

  @Put("goal")
  async putGoal(
    @Body(new ZodValidationPipe(putWaterGoalSchema)) body: PutWaterGoalInput,
  ): Promise<WaterGoalResponse> {
    return {
      goal: await this.waterService.putGoal(this.caller.requireUserId(), body),
    };
  }
}
