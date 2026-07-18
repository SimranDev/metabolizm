import type { SyncDiaryResponse } from "@metabolizm/shared";
import { Controller, Get, Query } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { syncDiaryQuerySchema, type SyncDiaryQuery } from "./sync.schemas";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly caller: CallerContext,
  ) {}

  @Get("diary")
  pullDiary(
    @Query(new ZodValidationPipe(syncDiaryQuerySchema)) query: SyncDiaryQuery,
  ): Promise<SyncDiaryResponse> {
    return this.syncService.pullDiary(this.caller.requireUserId(), query);
  }
}
