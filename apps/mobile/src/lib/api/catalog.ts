/**
 * Catalog endpoints (apps/api catalog module). Result shapes are the server
 * contract types from @metabolizm/shared — all nutrient values per 100 base
 * units (g|ml); portion math happens at display time (see lib/food).
 */

import { apiFetch } from "./client";

import type { FoodDto, FoodSearchResponse } from "@metabolizm/shared";

/**
 * Search the food catalog. One page per call (default server page size);
 * pass `cursor` from the previous response's `nextCursor` for the next page.
 */
export function searchFoods(
  q: string,
  opts?: { cursor?: string; signal?: AbortSignal },
): Promise<FoodSearchResponse> {
  const params = new URLSearchParams({ q });
  if (opts?.cursor) params.set("cursor", opts.cursor);
  return apiFetch(`/catalog/foods?${params.toString()}`, {
    signal: opts?.signal,
  });
}

/** Full food record: macro columns, nutrients map, and portions. */
export function getFood(
  id: string,
  opts?: { signal?: AbortSignal },
): Promise<FoodDto> {
  return apiFetch(`/catalog/foods/${encodeURIComponent(id)}`, {
    signal: opts?.signal,
  });
}
