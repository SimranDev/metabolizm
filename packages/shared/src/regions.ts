/**
 * Food-database regions. The SINGLE source for the supported list — apps/api
 * validates `users.region` against it and apps/mobile builds its picker from
 * it, so the two cannot drift.
 *
 * A region RANKS search results, it never filters them. A New Zealander who
 * bought an American protein powder must still be able to find it, just lower
 * down; hard filtering turns a ranking problem into "your app doesn't have my
 * food". See `regionRank` in CatalogService.listFoods.
 */
import { z } from "zod";

/** ISO 3166-1 alpha-2. Append-only in spirit: a stored users.region must stay valid. */
export const SUPPORTED_REGIONS = ["NZ", "AU", "US", "GB"] as const;

export type Region = (typeof SUPPORTED_REGIONS)[number];

export const regionSchema = z.enum(SUPPORTED_REGIONS);

/**
 * Default for a new account. Deliberately NOT relied upon: onboarding sets the
 * region explicitly from the device locale, because a silent default is a
 * silent wrong answer — the same trap `users.timezone` has, where an account
 * that never PATCHes it gets quietly mis-scoped results forever.
 */
export const DEFAULT_REGION: Region = "NZ";

export const REGION_LABELS: Record<Region, string> = {
  NZ: "New Zealand",
  AU: "Australia",
  US: "United States",
  GB: "United Kingdom",
};

/**
 * Markets that share enough of a product catalogue to rank as a near-match.
 * AU and NZ are ONE group: Trans-Tasman brand overlap is enormous (Sanitarium,
 * Arnott's, Wattie's, Bega, Fonterra), so an Australian record for a product
 * on a New Zealand shelf is almost always the right record.
 */
export const MARKET_GROUPS: readonly (readonly Region[])[] = [
  ["NZ", "AU"],
  ["US"],
  ["GB"],
];

export function isSupportedRegion(value: string): value is Region {
  return (SUPPORTED_REGIONS as readonly string[]).includes(value);
}

/** Every region sharing a market group with `region`, including itself. */
export function marketGroupOf(region: Region): readonly Region[] {
  return MARKET_GROUPS.find((g) => g.includes(region)) ?? [region];
}
