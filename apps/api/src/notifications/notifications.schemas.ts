import { z } from "zod";

/**
 * An Expo push token. Shape-checked here and validated properly by
 * `Expo.isExpoPushToken` in the service — this only keeps obvious junk out.
 */
export const registerDeviceSchema = z.object({
  token: z.string().trim().min(1).max(256),
  platform: z.enum(["ios", "android"]),
});
export type RegisterDeviceInput = z.output<typeof registerDeviceSchema>;

export const deviceTokenParamSchema = z.string().trim().min(1).max(256);
