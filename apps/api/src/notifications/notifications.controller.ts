import { Body, Controller, Delete, HttpCode, Param, Post } from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  deviceTokenParamSchema,
  registerDeviceSchema,
  type RegisterDeviceInput,
} from "./notifications.schemas";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly caller: CallerContext,
  ) {}

  /** Called after the user grants notifications, and again after each sign-in. */
  @Post("devices")
  @HttpCode(204)
  async registerDevice(
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceInput,
  ): Promise<void> {
    await this.notifications.registerDevice(
      this.caller.requireUserId(),
      body.token,
      body.platform,
    );
  }

  /**
   * Called on sign-out, BEFORE the session cookie is dropped — see
   * lib/session/endSession on the client. Without it the next person to sign
   * in on that phone keeps receiving the previous account's notifications.
   */
  @Delete("devices/:token")
  @HttpCode(204)
  async unregisterDevice(
    @Param("token", new ZodValidationPipe(deviceTokenParamSchema)) token: string,
  ): Promise<void> {
    await this.notifications.unregisterDevice(
      this.caller.requireUserId(),
      token,
    );
  }
}
