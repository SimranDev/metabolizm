import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { WaterController } from "./water.controller";
import { WaterService } from "./water.service";

/**
 * Deliberately imports no `SummariesModule`.
 *
 * `daily_summaries` has exactly two writers with disjoint SET maps, and
 * hydration appears in no group share_config — so it neither belongs in that
 * read model nor needs to recompute anything. Adding the import is the first
 * step of a change that would break the writers invariant; see water.service.ts.
 */
@Module({
  controllers: [WaterController],
  providers: [WaterService, CallerContext],
  exports: [WaterService],
})
export class WaterModule {}
