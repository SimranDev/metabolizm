/**
 * Device registration for push notifications (apps/api notifications module).
 *
 * Both calls are authenticated, which is the whole point: a push token belongs
 * to whoever is signed in on that device right now, so registering rebinds it
 * and unregistering must happen while the session still exists.
 */

import { apiRequest } from "./client";

type Signal = { signal?: AbortSignal };

export type DevicePlatform = "ios" | "android";

export function registerDevice(
  token: string,
  platform: DevicePlatform,
  opts?: Signal,
): Promise<void> {
  return apiRequest("/notifications/devices", {
    method: "POST",
    body: { token, platform },
    ...opts,
  });
}

/** Bodyless — see `groupsApi.leaveGroup` for why that matters to Fastify. */
export function unregisterDevice(token: string, opts?: Signal): Promise<void> {
  return apiRequest(`/notifications/devices/${encodeURIComponent(token)}`, {
    method: "DELETE",
    ...opts,
  });
}
