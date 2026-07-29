import { Module } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Push notifications, and eventually the mail seam.
 *
 * Deliberately knows nothing about groups: groups imports this, never the
 * other way round, so a domain module can notify without this one growing a
 * dependency on every feature that wants to.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, CallerContext],
  exports: [NotificationsService],
})
export class NotificationsModule {}
