import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { DiaryController } from "./diary.controller";
import { DiaryService } from "./diary.service";

@Module({
  controllers: [DiaryController],
  providers: [DiaryService, CallerContext],
  exports: [DiaryService],
})
export class DiaryModule {}
