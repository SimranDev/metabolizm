import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { SummariesController } from "./summaries.controller";
import { SummariesReadService } from "./summaries.read.service";
import { SummariesService } from "./summaries.service";

@Module({
  controllers: [SummariesController],
  providers: [SummariesService, SummariesReadService, CallerContext],
  // Only the write-side service is exported: diary/users/weight import this
  // module to recompute rows inside their own transactions. The read service
  // is this module's own, served over its controller.
  exports: [SummariesService],
})
export class SummariesModule {}
