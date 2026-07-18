/**
 * Thin fetch wrapper for the Metabolizm backend (apps/api, global prefix /v1).
 * Callers get parsed JSON and `try/catch` the thrown `Error`s (user-facing
 * messages), mirroring `lib/auth`; `AbortError` propagates so callers can
 * cancel in-flight requests.
 */

import { authClient } from "@/lib/auth/client";
import { BASE_URL } from "./base-url";

/** GET `${BASE_URL}/v1${path}` and parse the JSON body as `T`. */
export async function apiFetch<T>(
  path: string,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  // The Better Auth session cookie (cached in SecureStore by the expo
  // plugin); empty when signed out — anonymous callers see the system
  // catalog only. `credentials: "omit"` so the manual header is the only
  // cookie source.
  const cookie = authClient.getCookie();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/v1${path}`, {
      signal: opts?.signal,
      credentials: "omit",
      headers: {
        accept: "application/json",
        ...(cookie ? { Cookie: cookie } : null),
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
