import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { FastingController } from "./fasting.controller";
import { FastingService } from "./fasting.service";

/**
 * Deliberately imports no `SummariesModule` — same reasoning as `WaterModule`.
 * `daily_summaries` has two writers with disjoint SET maps, and fasting is in
 * no group share_config, so it neither belongs in that read model nor needs to
 * recompute anything.
 */
@Module({
  controllers: [FastingController],
  providers: [FastingService, CallerContext],
  exports: [FastingService],
})
export class FastingModule {}
