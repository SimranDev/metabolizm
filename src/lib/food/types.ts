/**
 * Types for USDA FoodData Central (FDC) food search. The `Usda*` shapes cover
 * only the fields we read from the `/foods/search` response; `FoodSearchItem` is
 * the normalized result the Log UI renders.
 */

import type { Macros } from "@/lib/health";

/** Dominant-macro accent, mapped to the theme's macro colors for the row dot. */
export type FoodAccent = "protein" | "carbs" | "fat";

/** A normalized search result, shaped for the food-search UI. */
export type FoodSearchItem = {
  id: string;
  name: string;
  calories: number;
  /** Human serving description, e.g. "1 cup (39 g)" or "100 g". */
  serving: string;
  /** Grams of each macro for the same basis as `calories` (drives the day summary). */
  macros: Macros;
  accent: FoodAccent;
  /** Backed by USDA-curated data (not a branded label) — shows the seal badge. */
  verified: boolean;
};

/** One entry in a food's `foodNutrients` (values are per 100 g in search results). */
export type UsdaFoodNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

export type UsdaDataType = "Foundation" | "SR Legacy" | "Branded" | "Survey (FNDDS)";

/** A single food in the `/foods/search` response (only the fields we use). */
export type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: UsdaDataType | string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaFoodNutrient[];
};

export type UsdaSearchResponse = {
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: UsdaFood[];
};
