/**
 * Types for USDA FoodData Central (FDC) food search. The `Usda*` shapes cover
 * only the fields we read from the `/foods/search` response; `FoodSearchItem` is
 * the normalized result the Log UI renders.
 */

import type { Macros } from "@/lib/health";

/** Dominant-macro accent, mapped to the theme's macro colors for the row dot. */
export type FoodAccent = "protein" | "carbs" | "fat";

/** A choosable amount unit for a food: a display label and its weight in grams. */
export type FoodUnit = {
  /** e.g. "Grams", "Ounces", "1 cup (39 g)". */
  label: string;
  /** Grams for one of this unit (e.g. 1 for grams, 28.35 for oz, 39 for "1 cup"). */
  grams: number;
};

/**
 * A full nutrition breakdown for a given basis (per 100 g, or a chosen amount).
 * Calories + macros are always present; micros are optional (USDA coverage varies).
 */
export type Nutrition = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  saturatedFatG?: number;
  transFatG?: number;
  cholesterolMg?: number;
  sodiumMg?: number;
  fiberG?: number;
  sugarsG?: number;
  vitaminDMcg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
};

/**
 * Detailed food data from the FDC `/food/{fdcId}` endpoint, shaped for the
 * nutrition-info screen. `per100g` is the basis the screen scales by the chosen
 * amount; `units` are the selectable amount units; `form` picks the base units.
 */
export type FoodDetail = {
  id: string;
  name: string;
  verified: boolean;
  accent: FoodAccent;
  form: "solid" | "liquid";
  per100g: Nutrition;
  units: FoodUnit[];
  /** Index into `units` to preselect (the food's own serving when it has one). */
  defaultUnitIndex: number;
};

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
  /** Chosen amount when configured via the nutrition-info screen (else undefined). */
  quantity?: number;
  /** Chosen unit when configured via the nutrition-info screen (else undefined). */
  unit?: FoodUnit;
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

/**
 * One nutrient in a `/food/{fdcId}` detail response. NOTE: the detail endpoint
 * nests the id under `nutrient` and names the value `amount` — unlike the search
 * endpoint's flat `{ nutrientId, value }` (see `UsdaFoodNutrient`).
 */
export type UsdaDetailNutrient = {
  nutrient?: { id?: number; name?: string; unitName?: string };
  amount?: number;
};

/** One alternate portion for a food (e.g. "1 cup"), with its weight in grams. */
export type UsdaFoodPortion = {
  amount?: number;
  modifier?: string;
  gramWeight?: number;
  measureUnit?: { name?: string; abbreviation?: string };
  portionDescription?: string;
};

/** A `/food/{fdcId}` detail response (only the fields we use). */
export type UsdaFoodDetail = {
  fdcId: number;
  description: string;
  dataType?: UsdaDataType | string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodCategory?: { description?: string } | string;
  foodNutrients?: UsdaDetailNutrient[];
  foodPortions?: UsdaFoodPortion[];
};
