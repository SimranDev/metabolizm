/**
 * Catalog endpoints (apps/api catalog module). Result shapes are the server
 * contract types from @metabolizm/shared — all nutrient values per 100 base
 * units (g|ml); portion math happens at display time (see lib/food).
 */

// Reads go through apiFetch (food-specific copy, GET-only). Writes go through
// apiRequest, which preserves ApiError.status — the create screen has to tell
// a 409 "this barcode is already registered" apart from a generic failure.
import { apiFetch, apiRequest } from "./client";

import type {
  CreateFoodRequest,
  FoodDto,
  FoodSearchResponse,
  UpdateFoodRequest,
} from "@metabolizm/shared";

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

/**
 * Look up a food by scanned barcode. Three outcomes the caller must render
 * differently, so this deliberately uses `apiRequest` and preserves the status:
 *   200 found · 404 not in the catalog · 422 a store's own weight/price label,
 * which has no global product behind it and can never resolve.
 *
 * The code is normalised client-side first (see `normalizeGtin`) so an
 * unreadable scan never becomes a request, and the server normalises again.
 */
export function getFoodByBarcode(code: string): Promise<FoodDto> {
  return apiRequest(`/catalog/foods/by-barcode/${encodeURIComponent(code)}`);
}

/**
 * Create a food. A `public` one is live in everyone's search immediately and
 * is reviewed afterwards — the server stamps `reviewStatus` and `reviewFlags`
 * itself, so neither is ever sent from here.
 *
 * All macro values are PER 100 base units. Energy is always kcal: the kJ/kcal
 * toggle on the form converts once, at the input boundary.
 */
export function createFood(body: CreateFoodRequest): Promise<FoodDto> {
  return apiRequest('/catalog/foods', { method: 'POST', body });
}

/** Patch a food the caller owns. Editing nutrition re-opens its review. */
export function updateFood(id: string, body: UpdateFoodRequest): Promise<FoodDto> {
  return apiRequest(`/catalog/foods/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
}

/** Soft-delete a food the caller owns. Logged diary entries keep their snapshot. */
export function deleteFood(id: string): Promise<void> {
  return apiRequest(`/catalog/foods/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * "This looks wrong." Reporting an approved food pulls it back into review.
 * Reporting your own is rejected by the server — edit or delete it instead.
 */
export function reportFood(id: string, reason: string): Promise<void> {
  return apiRequest(`/catalog/foods/${encodeURIComponent(id)}/reports`, {
    method: 'POST',
    body: { reason },
  });
}
