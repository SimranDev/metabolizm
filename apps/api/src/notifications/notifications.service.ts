import { devicePushTokens } from "@metabolizm/db";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { uuidv7 } from "uuidv7";

import { DB, type Database } from "../db/db.module";

export type DevicePlatform = "ios" | "android";

/**
 * What a push may say.
 *
 * **A push body may contain only a group name and a person's display name.**
 * Never a number, never a nutrition field, never a value gated by a share
 * config. A notification is a serialization surface that bypasses
 * `groups/masking.ts` entirely — it is assembled outside the service layer,
 * lands on a lock screen, and is never re-checked against the recipient's
 * config. Masking has no reach here, so the bound has to be stated and kept.
 *
 * It matters twice over: a device that signed out while offline still holds a
 * token bound to the previous account, so a body naming only a group and a
 * person is also what limits what the next person holding that phone can see.
 */
export type PushPayload = {
  title: string;
  body: string;
  /** Routing hint for the tap handler. Ids only, never user data. */
  data:
    | { kind: "group_invitation"; invitationId: string }
    | { kind: "group_join_request"; groupId: string; requestId: string }
    | { kind: "group_request_approved"; groupId: string };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // No access token: Expo only requires one for projects with push security
  // enabled, and it would be a required env var for a feature that must
  // degrade to "no notification" rather than block the server from booting.
  private readonly expo = new Expo();

  constructor(@Inject(DB) private readonly db: Database) {}

  /** Register (or reassign) this device's token to the caller. */
  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(token)) {
      // Not a client error worth surfacing: the app has nothing useful to do
      // with it, and a malformed token means no notifications, not a failure.
      this.logger.warn("Ignored a malformed Expo push token");
      return;
    }
    await this.db
      .insert(devicePushTokens)
      .values({ id: uuidv7(), userId, token, platform })
      .onConflictDoUpdate({
        target: devicePushTokens.token,
        set: { userId, platform, lastSeenAt: new Date() },
      });
  }

  /**
   * Forget this device. Scoped to the caller so one account can't unregister
   * another's device, and idempotent so signing out twice is harmless.
   */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.db
      .delete(devicePushTokens)
      .where(
        and(
          eq(devicePushTokens.token, token),
          eq(devicePushTokens.userId, userId),
        ),
      );
  }

  /**
   * Send to every device a user has.
   *
   * **Call this AFTER the transaction commits, never inside it.** A rollback
   * (a unique race, a seat cap) would otherwise still fire the push, telling
   * someone about an invitation that does not exist.
   *
   * Never throws: a notification is an extra, so a failed send must not turn a
   * successful write into an error for the caller.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const devices = await this.db
        .select({ token: devicePushTokens.token })
        .from(devicePushTokens)
        .where(eq(devicePushTokens.userId, userId));
      if (devices.length === 0) return;

      const messages: ExpoPushMessage[] = devices.map((device) => ({
        to: device.token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data,
      }));

      const tickets: ExpoPushTicket[] = [];
      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
      }
      await this.pruneUnregistered(messages, tickets);
    } catch (error) {
      this.logger.warn(
        `Push send failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  /**
   * Drop tokens Expo says are dead.
   *
   * Without this the table only grows: an uninstalled app leaves a token that
   * fails forever, and every later send pays for it. Tickets come back in
   * request order, which is how a `DeviceNotRegistered` error is matched to
   * the token that caused it.
   */
  private async pruneUnregistered(
    messages: ExpoPushMessage[],
    tickets: ExpoPushTicket[],
  ): Promise<void> {
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        const to = messages[i]?.to;
        if (typeof to === "string") dead.push(to);
      }
    });
    if (dead.length === 0) return;
    await this.db
      .delete(devicePushTokens)
      .where(inArray(devicePushTokens.token, dead));
    this.logger.log(`Pruned ${dead.length} unregistered device token(s)`);
  }
}
