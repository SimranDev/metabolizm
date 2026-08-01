/**
 * Fasting endpoints (apps/api fasting module).
 *
 * Only the two ends of the interval cross this boundary. Elapsed is always
 * derived on whichever side is displaying it — a duration sent over the wire is
 * stale the moment it arrives.
 */

import type {
  FastingCurrentResponse,
  FastingSessionResponse,
  FastingSessionsResponse,
} from "@metabolizm/shared";

import { apiRequest } from "./client";

type Signal = { signal?: AbortSignal };

export type StartFastBody = {
  /** Client-generated UUIDv7 — retrying a queued start is idempotent. */
  id?: string;
  /** Omit for "now". Bounded server-side to 48 hours of backdating. */
  startedAt?: string;
  targetHours: number;
  protocol?: string;
  note?: string | null;
};

export function getCurrent(opts?: Signal): Promise<FastingCurrentResponse> {
  return apiRequest("/fasting/current", opts);
}

export function startFast(
  body: StartFastBody,
  opts?: Signal,
): Promise<FastingSessionResponse> {
  return apiRequest("/fasting/sessions", { method: "POST", body, ...opts });
}

/**
 * Sending `endedAt` is what ends a fast — there is no implicit "close it now",
 * so a note-only patch can't silently stop a running one.
 */
export function patchFast(
  id: string,
  body: { endedAt?: string; targetHours?: number; note?: string | null },
  opts?: Signal,
): Promise<FastingSessionResponse> {
  return apiRequest(`/fasting/sessions/${id}`, {
    method: "PATCH",
    body,
    ...opts,
  });
}

export function listSessions(
  params: { cursor?: string; limit?: number } = {},
  opts?: Signal,
): Promise<FastingSessionsResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString();
  return apiRequest(`/fasting/sessions${suffix ? `?${suffix}` : ""}`, opts);
}

/** Sends no body — Fastify 400s on an empty body with a JSON content-type. */
export function deleteSession(id: string, opts?: Signal): Promise<void> {
  return apiRequest(`/fasting/sessions/${id}`, { method: "DELETE", ...opts });
}
