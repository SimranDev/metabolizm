import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  controllers: [SyncController],
  providers: [SyncService, CallerContext],
  exports: [SyncService],
})
export class SyncModule {}
