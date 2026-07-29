/**
 * Catalog review: the status a food carries through moderation, and the
 * heuristics that triage one for an admin.
 *
 * There is no staging table — a public user food goes live immediately and
 * carries `review_status` as a *state* (see CLAUDE.md "Catalog review"). This
 * module is the shared half: pure, dependency-free, and consumed by apps/api
 * (on create/update), apps/admin (queue ordering and the detail panel) and
 * apps/mobile (the live warning on the create-food form). It follows the same
 * precedent as nutrients.ts and catalog-schemas.ts — runtime, but pure.
 *
 * Every value it reads is PER 100 base units (g or ml), never per serving.
 */
import { z } from "zod";

export type FoodReviewStatus = "pending" | "approved" | "rejected" | "needs_edit";

export const foodReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "needs_edit",
]);

export type FoodFlagSeverity = "high" | "medium" | "low";

/**
 * APPEND-ONLY, like the nutrient registry: these codes are persisted in
 * `foods.review_flags` and read back by older admin builds. Never rename or
 * reuse one.
 *
 * The last three are NOT produced by `evaluateFoodFlags`: the first two need a
 * database lookup and are appended by apps/api after the pure pass, and
 * `carbs_include_fibre` is stamped by the USDA importer.
 */
export type FoodFlagCode =
  | "energy_unit_confusion"
  | "atwater_mismatch"
  | "macros_exceed_base"
  | "implausible_energy"
  | "all_zero"
  | "no_portions"
  | "suspicious_text"
  | "duplicate_name_brand"
  | "first_record_for_gtin"
  /**
   * `carbsG` on this row may still INCLUDE fibre. Set by the USDA importer
   * when a source food had no fibre value (1079) to subtract, so available
   * carbohydrate could not be derived. Not produced by evaluateFoodFlags —
   * it records provenance rather than judging the numbers, and it exists so
   * these rows are findable instead of silently wrong.
   */
  | "carbs_include_fibre";

/**
 * Severity per code, including the two DB-derived ones, so the admin queue's
 * ordering can never disagree with what the evaluator stamped on the row.
 */
export const FOOD_FLAG_SEVERITY: Record<FoodFlagCode, FoodFlagSeverity> = {
  energy_unit_confusion: "high",
  atwater_mismatch: "high",
  macros_exceed_base: "high",
  implausible_energy: "high",
  all_zero: "medium",
  no_portions: "low",
  suspicious_text: "low",
  duplicate_name_brand: "medium",
  first_record_for_gtin: "high",
  carbs_include_fibre: "medium",
};

export const FOOD_FLAG_SEVERITY_RANK: Record<FoodFlagSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export type FoodFlag = {
  code: FoodFlagCode;
  severity: FoodFlagSeverity;
  /** Human-readable, for the admin panel and the mobile warning. */
  detail?: string;
  /**
   * Machine-readable companion to `detail` — currently the implied kcal on
   * `energy_unit_confusion`, which is what the admin's "apply implied kcal"
   * button writes. Deliberately a separate field: parsing a number back out
   * of a display string is the kind of thing that breaks silently when the
   * copy is reworded.
   */
  value?: number;
};

export const foodFlagCodeSchema = z.enum([
  "energy_unit_confusion",
  "atwater_mismatch",
  "macros_exceed_base",
  "implausible_energy",
  "all_zero",
  "no_portions",
  "suspicious_text",
  "duplicate_name_brand",
  "first_record_for_gtin",
  "carbs_include_fibre",
]);

export const foodFlagSchema = z.object({
  code: foodFlagCodeSchema,
  severity: z.enum(["high", "medium", "low"]),
  detail: z.string().optional(),
  value: z.number().optional(),
});

export const foodFlagsSchema = z.array(foodFlagSchema);

/** kcal → kJ. The AU/NZ nutrition information panel is kJ-primary. */
export const KJ_PER_KCAL = 4.184;

/**
 * The subset of a food `evaluateFoodFlags` reads. Structurally satisfied by
 * `CreateFoodInput` and by a row merged with an update patch, so neither
 * caller has to build an adapter.
 */
export type FoodFlagInput = {
  name: string;
  baseUnit: "g" | "ml";
  /** Per 100 base units. */
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingLabel?: string | null;
  portions?: readonly unknown[];
};

/** 4·protein + 4·carbs + 9·fat — the energy the macros themselves imply. */
export function atwaterKcal(input: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}): number {
  return 4 * input.proteinG + 4 * input.carbsG + 9 * input.fatG;
}

// Below this the ratio tests stop meaning anything: 12% of 4.184×0 is 0, which
// would stamp a high-severity "you typed kJ" on every zero-calorie drink.
// `all_zero` covers that case at medium instead.
const MIN_ATWATER_FOR_RATIO = 20;

// Pure fat is ~900 kcal/100 g and nothing is denser, so anything above this is
// a data-entry error rather than a food.
const MAX_PLAUSIBLE_KCAL = 900;

// Macro grams per 100 base units. 100 g of food cannot contain more than 100 g
// of macros, but 100 *ml* legitimately can — honey is ~1.42 g/ml, so 100 ml
// carries ~117 g of carbs. Flagging that would put every syrup and condensed
// milk in the queue.
const MAX_MACRO_SUM_G = 100;
const MAX_MACRO_SUM_ML = 150;

function flag(
  code: FoodFlagCode,
  detail?: string,
  value?: number,
): FoodFlag {
  const result: FoodFlag = { code, severity: FOOD_FLAG_SEVERITY[code] };
  if (detail !== undefined) result.detail = detail;
  if (value !== undefined) result.value = value;
  return result;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A URL in a food name is spam, not a brand. */
function hasUrl(name: string): boolean {
  return /(https?:\/\/|www\.)/i.test(name);
}

function isShouting(name: string): boolean {
  return (
    name.length > 12 && /[A-Z]/.test(name) && name === name.toUpperCase()
  );
}

/** "aaargh", "!!!!" — keyboard mashing, not a product. */
function hasRepeatedRun(name: string): boolean {
  return /(.)\1{2,}/.test(name);
}

/**
 * Triage heuristics for a user-created food. Pure and synchronous so the
 * mobile create-food form can run it on every keystroke and warn the user
 * before they submit — catching a typo there is worth far more than catching
 * it in the admin queue a week later.
 *
 * This is where the review feature's value lives: it turns "an admin reads
 * thousands of rows" into "an admin triages a handful". It NEVER blocks a
 * write; a flagged food is still created and still goes live.
 *
 * Two codes are missing by design — `duplicate_name_brand` and
 * `first_record_for_gtin` need a database and are appended by apps/api.
 */
export function evaluateFoodFlags(input: FoodFlagInput): FoodFlag[] {
  const flags: FoodFlag[] = [];
  const { energyKcal, proteinG, carbsG, fatG } = input;
  const atwater = atwaterKcal(input);
  const macroSum = proteinG + carbsG + fatG;

  // Evaluated first, and it suppresses atwater_mismatch: a kJ figure typed
  // into a kcal field ALWAYS also fails the atwater check, and showing an
  // admin both flags buries the one that says what actually happened.
  //
  // AU/NZ panels are kJ-primary and frequently omit kcal entirely, so this is
  // the single most likely mistake in this market — and a 4.184× overstatement
  // looks entirely plausible in a list while silently wrecking a day's totals.
  // Same failure class as a pound value typed into a kilogram field.
  let energyUnitConfusion = false;
  if (atwater >= MIN_ATWATER_FOR_RATIO) {
    const expectedKj = KJ_PER_KCAL * atwater;
    if (Math.abs(energyKcal - expectedKj) <= 0.12 * expectedKj) {
      energyUnitConfusion = true;
      const impliedKcal = round(energyKcal / KJ_PER_KCAL);
      flags.push(
        flag(
          "energy_unit_confusion",
          `${round(energyKcal)} looks like kilojoules — that is ${impliedKcal} kcal, which matches the ${round(atwater)} kcal the macros imply.`,
          impliedKcal,
        ),
      );
    }
  }

  // Typos, and per-serving values entered as per-100.
  if (
    !energyUnitConfusion &&
    atwater >= MIN_ATWATER_FOR_RATIO &&
    Math.abs(energyKcal - atwater) > Math.max(20, 0.15 * energyKcal)
  ) {
    flags.push(
      flag(
        "atwater_mismatch",
        `Macros imply ${round(atwater)} kcal per 100 ${input.baseUnit}, but ${round(energyKcal)} was entered.`,
      ),
    );
  }

  const maxMacroSum =
    input.baseUnit === "ml" ? MAX_MACRO_SUM_ML : MAX_MACRO_SUM_G;
  if (macroSum > maxMacroSum) {
    flags.push(
      flag(
        "macros_exceed_base",
        `Protein + carbs + fat is ${round(macroSum)} g per 100 ${input.baseUnit}.`,
      ),
    );
  }

  if (energyKcal > MAX_PLAUSIBLE_KCAL) {
    flags.push(
      flag(
        "implausible_energy",
        `${round(energyKcal)} kcal per 100 ${input.baseUnit} exceeds pure fat (~900).`,
      ),
    );
  }

  if (energyKcal === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) {
    flags.push(flag("all_zero"));
  }

  const hasPortions = (input.portions?.length ?? 0) > 0;
  const hasServingLabel = Boolean(input.servingLabel?.trim());
  if (!hasPortions && !hasServingLabel) {
    flags.push(flag("no_portions", "No portions and no serving label."));
  }

  const name = input.name.trim();
  if (hasUrl(name) || isShouting(name) || hasRepeatedRun(name)) {
    flags.push(flag("suspicious_text"));
  }

  return flags;
}

/** Highest severity present, or null for a clean food. Drives queue ordering. */
export function highestFlagSeverity(
  flags: readonly FoodFlag[],
): FoodFlagSeverity | null {
  let best: FoodFlagSeverity | null = null;
  for (const f of flags) {
    if (
      best === null ||
      FOOD_FLAG_SEVERITY_RANK[f.severity] > FOOD_FLAG_SEVERITY_RANK[best]
    ) {
      best = f.severity;
    }
  }
  return best;
}

/** User-submitted "this food looks wrong". */
export const createFoodReportSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type CreateFoodReportInput = z.output<typeof createFoodReportSchema>;
