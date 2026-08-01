/**
 * Water endpoints (apps/api water module).
 *
 * Every volume crossing this boundary is in MILLILITRES. Litres and fluid
 * ounces are display units converted once at render (see lib/water) — the same
 * rule the weight client applies to kilograms, and for the same reason:
 * rounding on both sides drifts the day total away from the drinks that make
 * it up.
 */

import type {
  WaterEntriesResponse,
  WaterEntryResponse,
  WaterGoalResponse,
  WaterSummaryResponse,
} from "@metabolizm/shared";

import { apiRequest } from "./client";

type Signal = { signal?: AbortSignal };

export type LogWaterInput = {
  /** Client-generated UUIDv7 — retrying a queued log is idempotent. */
  id?: string;
  entryDate: string;
  loggedAt: string;
  volumeMl: number;
  source?: string;
};

export function logWater(
  input: LogWaterInput,
  opts?: Signal,
): Promise<WaterEntryResponse> {
  return apiRequest("/water/entries", { method: "POST", body: input, ...opts });
}

export function listEntries(
  params: { cursor?: string; limit?: number } = {},
  opts?: Signal,
): Promise<WaterEntriesResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString();
  return apiRequest(`/water/entries${suffix ? `?${suffix}` : ""}`, opts);
}

/** Sends no body — Fastify 400s on an empty body with a JSON content-type. */
export function deleteEntry(id: string, opts?: Signal): Promise<void> {
  return apiRequest(`/water/entries/${id}`, { method: "DELETE", ...opts });
}

export function getSummary(
  params: { days?: number } = {},
  opts?: Signal,
): Promise<WaterSummaryResponse> {
  const suffix = params.days ? `?days=${params.days}` : "";
  return apiRequest(`/water/summary${suffix}`, opts);
}

export function getGoal(opts?: Signal): Promise<WaterGoalResponse> {
  return apiRequest("/water/goal", opts);
}

export function putGoal(
  input: { dailyGoalMl: number },
  opts?: Signal,
): Promise<WaterGoalResponse> {
  return apiRequest("/water/goal", { method: "PUT", body: input, ...opts });
}
