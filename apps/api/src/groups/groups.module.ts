import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { NotificationsModule } from "../notifications/notifications.module";
import { SummariesModule } from "../summaries/summaries.module";
import { GroupsController } from "./groups.controller";
import { GroupsReadService } from "./groups.read.service";
import { GroupsService } from "./groups.service";

@Module({
  imports: [SummariesModule, NotificationsModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupsReadService, CallerContext],
  exports: [GroupsService],
})
export class GroupsModule {}
