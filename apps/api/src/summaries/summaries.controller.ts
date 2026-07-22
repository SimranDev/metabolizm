import type { SummaryDaysResponse } from "@metabolizm/shared";
import { Controller, Get, Query } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { SummariesReadService } from "./summaries.read.service";
import {
  summaryDaysQuerySchema,
  type SummaryDaysQuery,
} from "./summaries.schemas";

@Controller("summaries")
export class SummariesController {
  constructor(
    private readonly summaries: SummariesReadService,
    private readonly caller: CallerContext,
  ) {}

  /**
   * The caller's own daily rollups over an inclusive date range, plus their
   * current local date and logging streak. Backs the Log tab's day strip and
   * calendar for days the device no longer holds entries for.
   */
  @Get("days")
  listDays(
    @Query(new ZodValidationPipe(summaryDaysQuerySchema)) query: SummaryDaysQuery,
  ): Promise<SummaryDaysResponse> {
    return this.summaries.listDays(this.caller.requireUserId(), query);
  }
}
