/**
 * Thin fetch wrapper for the Metabolizm backend (apps/api, global prefix /v1).
 * Callers get parsed JSON and `try/catch` the thrown `Error`s (user-facing
 * messages), mirroring `lib/auth`; `AbortError` propagates so callers can
 * cancel in-flight requests.
 */

import { Platform } from "react-native";

// EXPO_PUBLIC_ vars are inlined at bundle time — the access must stay a
// literal member expression. Empty/unset falls through to the simulator
// default; Android emulators reach the host machine via 10.0.2.2, not
// localhost. Physical devices need EXPO_PUBLIC_API_URL=http://<lan-ip>:3000.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Platform.select({
    android: "http://10.0.2.2:3000",
    default: "http://localhost:3000",
  });

/**
 * TODO(auth): interim caller identity, mirroring the api's `x-user-id` stub
 * (apps/api/src/common/caller-context.ts). Must be a UUID matching an existing
 * `users.id` row — the api 401s on any other shape. `null` sends no header:
 * anonymous callers see the system catalog only. Replace with the real auth
 * token once the auth module lands; this constant is the only place the app
 * knows who it is.
 */
const DEV_USER_ID: string | null = null;

/** GET `${BASE_URL}/v1${path}` and parse the JSON body as `T`. */
export async function apiFetch<T>(
  path: string,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/v1${path}`, {
      signal: opts?.signal,
      headers: {
        accept: "application/json",
        ...(DEV_USER_ID ? { "x-user-id": DEV_USER_ID } : null),
      },
    });
  } catch (err) {
    // Re-throw cancellations untouched; treat anything else as a network failure.
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new Error("Couldn't reach the food catalog. Check your connection.");
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("This food is no longer available.");
    }
    throw new Error("Food search failed. Please try again.");
  }

  return (await response.json()) as T;
}
