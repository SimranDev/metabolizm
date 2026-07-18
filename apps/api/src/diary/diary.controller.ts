import type {
  DiaryDaysResponse,
  DiaryRecentsResponse,
  UpsertDiaryEntriesResponse,
} from "@metabolizm/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
} from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  diaryDaysQuerySchema,
  diaryRecentsQuerySchema,
  entryIdParamSchema,
  upsertDiaryEntriesSchema,
  type DiaryDaysQuery,
  type DiaryRecentsQuery,
  type UpsertDiaryEntriesInput,
} from "./diary.schemas";
import { DiaryService } from "./diary.service";

@Controller("diary")
export class DiaryController {
  constructor(
    private readonly diaryService: DiaryService,
    private readonly caller: CallerContext,
  ) {}

  @Get("days")
  async listDays(
    @Query(new ZodValidationPipe(diaryDaysQuerySchema)) query: DiaryDaysQuery,
  ): Promise<DiaryDaysResponse> {
    return {
      entries: await this.diaryService.listDays(
        this.caller.requireUserId(),
        query,
      ),
    };
  }

  @Put("entries")
  async upsertEntries(
    @Body(new ZodValidationPipe(upsertDiaryEntriesSchema))
    body: UpsertDiaryEntriesInput,
  ): Promise<UpsertDiaryEntriesResponse> {
    return {
      entries: await this.diaryService.upsertEntries(
        this.caller.requireUserId(),
        body.entries,
      ),
    };
  }

  @Delete("entries/:id")
  @HttpCode(204)
  async deleteEntry(
    @Param("id", new ZodValidationPipe(entryIdParamSchema)) id: string,
  ): Promise<void> {
    await this.diaryService.deleteEntry(this.caller.requireUserId(), id);
  }

  @Get("recents")
  async recents(
    @Query(new ZodValidationPipe(diaryRecentsQuerySchema))
    query: DiaryRecentsQuery,
  ): Promise<DiaryRecentsResponse> {
    return {
      entries: await this.diaryService.recents(
        this.caller.requireUserId(),
        query.limit,
      ),
    };
  }
}
