/**
 * Push notifications.
 *
 * The only thing that notifies today is a group invitation, and the payload is
 * bounded to a group name plus a person's name (see the API's PushPayload) —
 * a notification never passes through the masking layer, so nothing gated by
 * a share config may appear in one.
 *
 * Order matters and is the classic silent failure: on Android 13+ the OS
 * permission prompt does not appear until a channel exists, and a channel is a
 * prerequisite for getting a token at all. Channel, then permission, then
 * token — never any other order.
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { pushApi } from '@/lib/api';

/** Matches the notification icon colour already set in app.json's plugin block. */
const CHANNEL_ID = 'groups';
const CHANNEL_COLOR = '#1C5279';

/**
 * How a foreground notification behaves.
 *
 * Module scope on purpose: the handler must be installed before any
 * notification can arrive, not inside a component that may not have mounted.
 * `shouldShowAlert` is deprecated in SDK 57 and silently shows nothing — the
 * banner/list pair replaced it.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** The token this device last registered, so sign-out can unregister it. */
let currentToken: string | null = null;

/**
 * The EAS project id, passed explicitly.
 *
 * `getExpoPushTokenAsync` can infer it, but the inference is what breaks in
 * standalone and TestFlight builds, so the docs say set it manually.
 */
function projectId(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  return fromExtra?.projectId ?? null;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Group invitations',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: CHANNEL_COLOR,
  });
}

/**
 * Whether notifications are granted, without ever prompting.
 *
 * iOS is checked on `ios.status` rather than the root `status`, which
 * collapses PROVISIONAL into an answer that reads as denied.
 */
async function isGranted(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (Platform.OS === 'ios') {
    const status = settings.ios?.status;
    return (
      status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }
  return settings.granted;
}

/**
 * Ask for notifications and register this device.
 *
 * `promptIfNeeded: false` re-registers a device that already said yes without
 * ever showing a prompt — that is the after-sign-in path, so a second device
 * starts receiving notifications without the user having to visit Groups.
 *
 * Returns quietly on failure. Push is an extra: no permission, a simulator
 * with no push support, or an unreachable API must all end in "no
 * notifications", never an error the user has to read.
 */
export async function registerForPush(
  { promptIfNeeded = true }: { promptIfNeeded?: boolean } = {},
): Promise<void> {
  try {
    await ensureAndroidChannel();

    if (!(await isGranted())) {
      if (!promptIfNeeded) return;
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted && asked.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
        return;
      }
    }

    const id = projectId();
    if (!id) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    currentToken = token;
    await pushApi.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    // Simulators without push, a denied prompt, an offline API — all just mean
    // no notifications until next time.
  }
}

/**
 * Hand this device back before signing out.
 *
 * MUST run while the session cookie still exists: the call is authenticated,
 * and `signOut()` drops the cookie. Without it, the next person to sign in on
 * this phone keeps receiving the previous account's notifications.
 */
export async function unregisterForPush(): Promise<void> {
  const token = currentToken;
  if (!token) return;
  currentToken = null;
  try {
    await pushApi.unregisterDevice(token);
  } catch {
    // Best-effort, exactly like signOut: an offline user must still get out.
  }
}

export type PushRoute = { kind: 'group_invitation'; invitationId: string };

/**
 * The route a notification's payload asks for, or null if it isn't one we
 * know. Unknown kinds are ignored rather than guessed at — a future server
 * can add one before an older client understands it.
 */
export function routeFromNotification(
  response: Notifications.NotificationResponse | null,
): PushRoute | null {
  const data = response?.notification.request.content.data;
  if (!data || typeof data !== 'object') return null;
  const kind = (data as { kind?: unknown }).kind;
  const invitationId = (data as { invitationId?: unknown }).invitationId;
  if (kind === 'group_invitation' && typeof invitationId === 'string') {
    return { kind, invitationId };
  }
  return null;
}
