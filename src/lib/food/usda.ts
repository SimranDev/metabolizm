/**
 * USDA FoodData Central (FDC) food search. This module is the only place that
 * talks to the FDC API — callers get back normalized `FoodSearchItem`s and
 * `try/catch` the thrown `Error`s (user-facing messages), mirroring `lib/auth`.
 *
 * The API key ships in the app bundle via `EXPO_PUBLIC_USDA_API_KEY` (see
 * `.env.example`). Move this behind a backend proxy once the cloud backend exists.
 */

import { buildUnits } from "./units";

import type {
  FoodAccent,
  FoodDetail,
  FoodSearchItem,
  Nutrition,
  UsdaFood,
  UsdaFoodDetail,
  UsdaSearchResponse,
} from "./types";

const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY;
const SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const DETAIL_URL = "https://api.nal.usda.gov/fdc/v1/food";
const PAGE_SIZE = 25;

/** FDC nutrient ids. Energy has several encodings; prefer kcal (1008). */
const ENERGY_IDS = [1008, 2048, 2047] as const;
const PROTEIN_ID = 1003;
const FAT_ID = 1004;
const CARBS_ID = 1005;
/** Micronutrient ids for the full nutrition label (some have multiple encodings). */
const SAT_FAT_ID = 1258;
const TRANS_FAT_ID = 1257;
const CHOLESTEROL_ID = 1253;
const SODIUM_ID = 1093;
const FIBER_ID = 1079;
const SUGARS_IDS = [2000, 1063] as const;
const VITAMIN_D_IDS = [1114, 1110] as const;
const CALCIUM_ID = 1087;
const IRON_ID = 1089;
const POTASSIUM_ID = 1092;

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Units whose per-100g nutrients we can scale to a serving size. */
const MASS_UNITS = new Set(["g", "gm", "ml", "mlt"]);

/**
 * Search FDC for foods matching `query`, returning up to `PAGE_SIZE` normalized
 * results. Throws an `Error` with a user-facing message on failure; lets
 * `AbortError` propagate so callers can cancel in-flight requests.
 */
export async function searchFoods(
  query: string,
  opts?: { signal?: AbortSignal },
): Promise<FoodSearchItem[]> {
  if (!API_KEY) {
    throw new Error("Food search isn't configured yet.");
  }

  const url =
    `${SEARCH_URL}?api_key=${API_KEY}` +
    `&query=${encodeURIComponent(query)}` +
    `&pageSize=${PAGE_SIZE}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: opts?.signal });
  } catch (err) {
    // Re-throw cancellations untouched; treat anything else as a network failure.
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new Error("Couldn't reach food search. Check your connection.");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Too many searches — try again in a moment.");
    }
    throw new Error("Food search failed. Please try again.");
  }

  const data = (await response.json()) as UsdaSearchResponse;
  return (data.foods ?? [])
    .map(toFoodItem)
    .filter((item): item is FoodSearchItem => item !== null);
}

/**
 * Fetch the full detail record for one food (`/food/{fdcId}`) — the per-100g
 * nutrition basis, micronutrients, and real portions the nutrition-info screen
 * needs. Throws user-facing `Error`s like `searchFoods`; propagates `AbortError`.
 */
export async function getFoodDetail(
  fdcId: string,
  opts?: { signal?: AbortSignal },
): Promise<FoodDetail> {
  if (!API_KEY) {
    throw new Error("Food search isn't configured yet.");
  }

  const url = `${DETAIL_URL}/${encodeURIComponent(fdcId)}?api_key=${API_KEY}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: opts?.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new Error("Couldn't reach food search. Check your connection.");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Too many searches — try again in a moment.");
    }
    throw new Error("Couldn't load nutrition details. Please try again.");
  }

  const food = (await response.json()) as UsdaFoodDetail;
  return toFoodDetail(food);
}

/** Normalize a detail response into the shape the nutrition-info screen renders. */
function toFoodDetail(food: UsdaFoodDetail): FoodDetail {
  const per100g: Nutrition = {
    calories: detailNutrient(food, ENERGY_IDS) ?? 0,
    proteinG: round1(detailNutrient(food, [PROTEIN_ID]) ?? 0),
    carbsG: round1(detailNutrient(food, [CARBS_ID]) ?? 0),
    fatG: round1(detailNutrient(food, [FAT_ID]) ?? 0),
    saturatedFatG: detailNutrient(food, [SAT_FAT_ID]),
    transFatG: detailNutrient(food, [TRANS_FAT_ID]),
    cholesterolMg: detailNutrient(food, [CHOLESTEROL_ID]),
    sodiumMg: detailNutrient(food, [SODIUM_ID]),
    fiberG: detailNutrient(food, [FIBER_ID]),
    sugarsG: detailNutrient(food, SUGARS_IDS),
    vitaminDMcg: detailNutrient(food, VITAMIN_D_IDS),
    calciumMg: detailNutrient(food, [CALCIUM_ID]),
    ironMg: detailNutrient(food, [IRON_ID]),
    potassiumMg: detailNutrient(food, [POTASSIUM_ID]),
  };
  const form = detailForm(food);
  const { units, defaultUnitIndex } = buildUnits(form, food.foodPortions);

  return {
    id: String(food.fdcId),
    name: foodName(food),
    verified: food.dataType !== "Branded",
    accent: dominantMacro(per100g.proteinG, per100g.carbsG, per100g.fatG),
    form,
    per100g,
    units,
    defaultUnitIndex,
  };
}

/**
 * Value of the first matching nutrient id in a *detail* response, else undefined.
 * The detail endpoint nests the id under `nutrient` and calls the value `amount`
 * (unlike the search endpoint's flat `{ nutrientId, value }` — see `firstNutrient`).
 */
function detailNutrient(food: UsdaFoodDetail, ids: readonly number[]): number | undefined {
  for (const id of ids) {
    const match = food.foodNutrients?.find(
      (n) => n.nutrient?.id === id && typeof n.amount === "number",
    );
    if (match) return match.amount as number;
  }
  return undefined;
}

/** Liquid when served in ml or categorized as a beverage; solid otherwise. */
function detailForm(food: UsdaFoodDetail): "solid" | "liquid" {
  if (food.servingSizeUnit?.toLowerCase() === "ml") return "liquid";
  const category =
    typeof food.foodCategory === "string" ? food.foodCategory : food.foodCategory?.description;
  if (category && /beverage|drink|milk|juice|water|soda|coffee|tea/i.test(category)) {
    return "liquid";
  }
  return "solid";
}

/** Normalize one USDA food, or `null` if it has no usable calorie value. */
function toFoodItem(food: UsdaFood): FoodSearchItem | null {
  const energy100 = firstNutrient(food, ENERGY_IDS);
  if (energy100 == null) return null;

  const protein100 = firstNutrient(food, [PROTEIN_ID]) ?? 0;
  const fat100 = firstNutrient(food, [FAT_ID]) ?? 0;
  const carbs100 = firstNutrient(food, [CARBS_ID]) ?? 0;

  const { factor, serving } = servingBasis(food);

  return {
    id: String(food.fdcId),
    name: foodName(food),
    calories: Math.round(energy100 * factor),
    serving,
    macros: {
      proteinG: round1(protein100 * factor),
      carbsG: round1(carbs100 * factor),
      fatG: round1(fat100 * factor),
    },
    accent: dominantMacro(protein100, carbs100, fat100),
    verified: food.dataType !== "Branded",
  };
}

/** Value of the first matching nutrient id (with a numeric value), else null. */
function firstNutrient(food: UsdaFood, ids: readonly number[]): number | null {
  for (const id of ids) {
    const match = food.foodNutrients?.find(
      (n) => n.nutrientId === id && typeof n.value === "number",
    );
    if (match) return match.value as number;
  }
  return null;
}

/**
 * As-returned basis: scale per-100g nutrients to the food's own serving when it
 * has a mass/volume serving size (Branded), otherwise report per 100 g.
 */
function servingBasis(food: UsdaFood): { factor: number; serving: string } {
  const size = food.servingSize;
  const unit = food.servingSizeUnit;
  if (size && size > 0 && unit && MASS_UNITS.has(unit.toLowerCase())) {
    const serving = food.householdServingFullText?.trim() || `${trimNum(size)} ${unit}`;
    return { factor: size / 100, serving };
  }
  return { factor: 1, serving: "100 g" };
}

/** Dominant macro by calorie contribution; defaults to protein when all zero. */
function dominantMacro(proteinG: number, carbsG: number, fatG: number): FoodAccent {
  const kcal = {
    protein: proteinG * KCAL_PER_G.protein,
    carbs: carbsG * KCAL_PER_G.carbs,
    fat: fatG * KCAL_PER_G.fat,
  };
  let best: FoodAccent = "protein";
  if (kcal.carbs > kcal[best]) best = "carbs";
  if (kcal.fat > kcal[best]) best = "fat";
  return best;
}

/** USDA descriptions are often ALL CAPS (branded); title-case those and add brand. */
function foodName(food: { description?: string; brandName?: string; brandOwner?: string }): string {
  const desc = food.description?.trim() ?? "";
  const name = desc && desc === desc.toUpperCase() ? titleCase(desc) : desc;
  const brand = food.brandName?.trim() || food.brandOwner?.trim();
  return brand ? `${name} (${titleCase(brand)})` : name;
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const trimNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Round grams to one decimal place. */
const round1 = (n: number) => Math.round(n * 10) / 10;
