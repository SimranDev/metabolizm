/**
 * Editable form model and conversions to/from server payloads. Numeric
 * inputs use `number | ""` so fields can be emptied while editing.
 */
import { NUTRIENTS, type FoodDto, type NutrientKey } from "@metabolizm/shared";

import type { ParsedFood } from "./api";

export type Num = number | "";

export type PortionDraft = {
  id?: string;
  label: string;
  quantity: Num;
  amountInBase: Num;
  isDefault: boolean;
};

export type NutrientDraft = { key: NutrientKey; value: Num };

export type FoodDraft = {
  name: string;
  brand: string;
  description: string;
  barcode: string;
  baseUnit: "g" | "ml";
  servingSize: Num;
  servingLabel: string;
  energyKcal: Num;
  proteinG: Num;
  carbsG: Num;
  fatG: Num;
  nutrients: NutrientDraft[];
  portions: PortionDraft[];
  /** Import provenance; sent on create only, never editable. */
  sourceRef: string | null;
};

export function emptyDraft(): FoodDraft {
  return {
    name: "",
    brand: "",
    description: "",
    barcode: "",
    baseUnit: "g",
    servingSize: 100,
    servingLabel: "",
    energyKcal: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    nutrients: [],
    portions: [],
    sourceRef: null,
  };
}

function toNutrientDrafts(map: Record<string, number>): NutrientDraft[] {
  return Object.entries(map)
    .filter((entry): entry is [NutrientKey, number] => entry[0] in NUTRIENTS)
    .sort((a, b) => NUTRIENTS[a[0]].sortOrder - NUTRIENTS[b[0]].sortOrder)
    .map(([key, value]) => ({ key, value }));
}

export function draftFromParsed(food: ParsedFood): FoodDraft {
  return {
    name: food.name ?? "",
    brand: food.brand ?? "",
    description: food.description ?? "",
    barcode: food.barcode ?? "",
    baseUnit: food.baseUnit ?? "g",
    servingSize: food.servingSize ?? 100,
    servingLabel: food.servingLabel ?? "",
    energyKcal: food.energyKcal ?? "",
    proteinG: food.proteinG ?? "",
    carbsG: food.carbsG ?? "",
    fatG: food.fatG ?? "",
    nutrients: toNutrientDrafts(food.nutrients ?? {}),
    portions: (food.portions ?? []).map((p) => ({
      label: p.label,
      quantity: p.quantity ?? 1,
      amountInBase: p.amountInBase,
      isDefault: p.isDefault ?? false,
    })),
    sourceRef: food.sourceRef ?? null,
  };
}

export function draftFromDto(dto: FoodDto): FoodDraft {
  return {
    name: dto.name,
    brand: dto.brand ?? "",
    description: dto.description ?? "",
    barcode: dto.barcode ?? "",
    baseUnit: dto.baseUnit,
    servingSize: dto.servingSize,
    servingLabel: dto.servingLabel ?? "",
    energyKcal: dto.energyKcal,
    proteinG: dto.proteinG,
    carbsG: dto.carbsG,
    fatG: dto.fatG,
    nutrients: toNutrientDrafts(dto.nutrients),
    portions: dto.portions.map((p) => ({
      id: p.id,
      label: p.label,
      quantity: p.quantity,
      amountInBase: p.amountInBase,
      isDefault: p.isDefault,
    })),
    sourceRef: dto.sourceRef,
  };
}

function num(value: Num, fallback = 0): number {
  return value === "" ? fallback : value;
}

function nutrientMap(drafts: NutrientDraft[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const { key, value } of drafts) {
    if (value !== "") map[key] = value;
  }
  return map;
}

function portionsPayload(portions: PortionDraft[]) {
  return portions.map((p) => ({
    ...(p.id ? { id: p.id } : {}),
    label: p.label,
    quantity: num(p.quantity, 1),
    amountInBase: num(p.amountInBase),
    isDefault: p.isDefault,
  }));
}

/** POST /api/foods body (create; optional empties omitted). */
export function toCreatePayload(draft: FoodDraft): unknown {
  return {
    name: draft.name,
    ...(draft.brand ? { brand: draft.brand } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.barcode ? { barcode: draft.barcode } : {}),
    baseUnit: draft.baseUnit,
    servingSize: num(draft.servingSize, 100),
    ...(draft.servingLabel ? { servingLabel: draft.servingLabel } : {}),
    energyKcal: num(draft.energyKcal),
    proteinG: num(draft.proteinG),
    carbsG: num(draft.carbsG),
    fatG: num(draft.fatG),
    nutrients: nutrientMap(draft.nutrients),
    portions: portionsPayload(draft.portions),
    ...(draft.sourceRef ? { sourceRef: draft.sourceRef } : {}),
  };
}

/** PATCH /api/foods/:id body (full editable state; empty text clears). */
export function toUpdatePayload(draft: FoodDraft): unknown {
  return {
    name: draft.name,
    brand: draft.brand || null,
    description: draft.description || null,
    barcode: draft.barcode || null,
    baseUnit: draft.baseUnit,
    servingSize: num(draft.servingSize, 100),
    servingLabel: draft.servingLabel || null,
    energyKcal: num(draft.energyKcal),
    proteinG: num(draft.proteinG),
    carbsG: num(draft.carbsG),
    fatG: num(draft.fatG),
    nutrients: nutrientMap(draft.nutrients),
    portions: portionsPayload(draft.portions),
  };
}
