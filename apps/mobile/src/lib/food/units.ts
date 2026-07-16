/**
 * Amount-unit math for the nutrition-info screen. USDA nutrients are stored per
 * 100 g (`FoodDetail.per100g`); a chosen `{ quantity, unit }` converts to grams,
 * and `scaleNutrition` rescales the whole label to that amount.
 */

import type { FoodUnit, Nutrition, UsdaFoodPortion } from "./types";

/** Grams per ounce (mass) and per fluid ounce (volume; density approximated 1 g/ml). */
export const G_PER_OZ = 28.3495;
export const G_PER_FL_OZ = 29.5735;

const round1 = (n: number) => Math.round(n * 10) / 10;
const trimNum = (n: number) => (Number.isInteger(n) ? String(n) : String(round1(n)));

/** Compact amount formatter: whole numbers plain, otherwise one decimal. */
export const formatGrams = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));

/** Base units offered for every food, chosen by whether it's a solid or a liquid. */
const BASE_UNITS: Record<"solid" | "liquid", FoodUnit[]> = {
  solid: [
    { label: "Grams", grams: 1 },
    { label: "Ounces", grams: G_PER_OZ },
  ],
  liquid: [
    // Volume treated as grams 1:1 since per-100g and per-100ml coincide at density 1.
    { label: "Milliliters", grams: 1 },
    { label: "Fluid ounces", grams: G_PER_FL_OZ },
  ],
};

/** Human label for a USDA portion, e.g. "1 cup (240 g)" — or null if unusable. */
function portionLabel(portion: UsdaFoodPortion): string | null {
  const grams = portion.gramWeight;
  if (!grams || grams <= 0) return null;
  const described = portion.portionDescription?.trim();
  const composed = [portion.amount, portion.modifier?.trim() || portion.measureUnit?.name?.trim()]
    .filter((part) => part != null && part !== "" && part !== "undefined")
    .join(" ")
    .trim();
  const name = described || composed;
  if (!name) return null;
  return `${name} (${trimNum(grams)} g)`;
}

/**
 * Selectable amount units for a food: the form's base units (grams/oz or ml/fl-oz)
 * followed by each real USDA portion. `defaultUnitIndex` prefers the food's own
 * first portion (matches the screenshot's "3 oz (85 g)" default), else grams.
 */
export function buildUnits(
  form: "solid" | "liquid",
  portions: UsdaFoodPortion[] | undefined,
): { units: FoodUnit[]; defaultUnitIndex: number } {
  const base = BASE_UNITS[form];
  const portionUnits: FoodUnit[] = [];
  for (const portion of portions ?? []) {
    const label = portionLabel(portion);
    if (label) portionUnits.push({ label, grams: portion.gramWeight as number });
  }
  const units = [...base, ...portionUnits];
  const defaultUnitIndex = portionUnits.length > 0 ? base.length : 0;
  return { units, defaultUnitIndex };
}

const scaleG = (per100g: number | undefined, grams: number) =>
  per100g == null ? undefined : round1((per100g * grams) / 100);
const scaleMg = (per100g: number | undefined, grams: number) =>
  per100g == null ? undefined : Math.round((per100g * grams) / 100);

/** Rescale a per-100g nutrition basis to `grams`, keeping only the fields present. */
export function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 0;
  return {
    calories: Math.round((per100g.calories * g) / 100),
    proteinG: round1((per100g.proteinG * g) / 100),
    carbsG: round1((per100g.carbsG * g) / 100),
    fatG: round1((per100g.fatG * g) / 100),
    saturatedFatG: scaleG(per100g.saturatedFatG, g),
    transFatG: scaleG(per100g.transFatG, g),
    fiberG: scaleG(per100g.fiberG, g),
    sugarsG: scaleG(per100g.sugarsG, g),
    cholesterolMg: scaleMg(per100g.cholesterolMg, g),
    sodiumMg: scaleMg(per100g.sodiumMg, g),
    calciumMg: scaleMg(per100g.calciumMg, g),
    potassiumMg: scaleMg(per100g.potassiumMg, g),
    ironMg: scaleG(per100g.ironMg, g),
    vitaminDMcg: scaleG(per100g.vitaminDMcg, g),
  };
}
