import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { SummariesModule } from "../summaries/summaries.module";
import { GroupsController } from "./groups.controller";
import { GroupsReadService } from "./groups.read.service";
import { GroupsService } from "./groups.service";

@Module({
  imports: [SummariesModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupsReadService, CallerContext],
  exports: [GroupsService],
})
export class GroupsModule {}
