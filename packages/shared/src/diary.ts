/**
 * Data shapes for the food diary — what a logged day looks like on the wire
 * and on disk. The zustand store that manages them lives in the mobile app
 * (src/store/diary.ts); a future backend reads/writes the same shapes.
 */

import type { FoodAccent, FoodUnit } from "./food";
import type { Macros } from "./health";

export type MealId = "breakfast" | "lunch" | "dinner" | "snack";

/** A single logged food. `entryId` is unique per instance (a food can be logged twice). */
export type DiaryEntry = {
  entryId: string;
  name: string;
  serving: string;
  calories: number;
  macros: Macros;
  accent: FoodAccent;
  verified: boolean;
  /** USDA food id, so the entry can be reopened/edited on the nutrition screen. */
  fdcId?: string;
  /** Amount + unit chosen on the nutrition screen (absent for quick-added foods). */
  quantity?: number;
  unit?: FoodUnit;
};

export type Meal = {
  id: MealId;
  label: string;
  entries: DiaryEntry[];
};

/** Fields the nutrition screen recomputes when a logged food's amount is edited. */
export type EntryPatch = Pick<DiaryEntry, "serving" | "calories" | "macros" | "quantity" | "unit">;
