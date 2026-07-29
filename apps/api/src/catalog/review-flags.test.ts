/**
 * Guards the catalog review triage thresholds (evaluateFoodFlags in
 * @metabolizm/shared).
 *
 * Clears the same bar as the other three suites: a wrong threshold here is
 * silent and plausible rather than a crash. Too loose and a food that is
 * 4.184× too energy-dense goes live unflagged and quietly wrecks a user's
 * totals; too tight and every legitimate high-fat food lands in the queue
 * until an admin stops reading it. Neither shows up as an error anywhere.
 *
 * Pure — no database, no HTTP. It lives under apps/api/src because that is
 * the only path the root vitest.config.ts globs.
 */
import { evaluateFoodFlags, type FoodFlagCode } from "@metabolizm/shared";
import { describe, expect, it } from "vitest";

function codes(input: Parameters<typeof evaluateFoodFlags>[0]): FoodFlagCode[] {
  return evaluateFoodFlags(input).map((f) => f.code);
}

describe("evaluateFoodFlags", () => {
  it("returns no flags for a clean food", () => {
    // Chicken breast, raw, per 100 g. Atwater = 156.4 vs 165 entered.
    expect(
      codes({
        name: "Chicken breast, raw",
        baseUnit: "g",
        energyKcal: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        servingLabel: "1 breast",
      }),
    ).toEqual([]);
  });

  it("flags per-serving energy entered against per-100 macros", () => {
    // Cereal: macros are per 100 g but the 30 g serving's 120 kcal was typed.
    const result = codes({
      name: "Wheat biscuit cereal",
      baseUnit: "g",
      energyKcal: 120,
      proteinG: 8,
      carbsG: 66,
      fatG: 6,
      servingLabel: "2 biscuits",
    });
    expect(result).toContain("atwater_mismatch");
    expect(result).not.toContain("energy_unit_confusion");
  });

  it("flags macros summing above 100 g per 100 g", () => {
    expect(
      codes({
        name: "Mystery powder",
        baseUnit: "g",
        energyKcal: 590,
        proteinG: 30,
        carbsG: 50,
        fatG: 30,
        servingLabel: "1 scoop",
      }),
    ).toContain("macros_exceed_base");
  });

  it("reads a kJ figure entered as kcal as a unit confusion, not a mismatch", () => {
    // AU/NZ panels are kJ-primary: 399 kcal of macros is 1669 kJ on the packet.
    const result = codes({
      name: "Muesli bar",
      baseUnit: "g",
      energyKcal: 1669,
      proteinG: 6,
      carbsG: 60,
      fatG: 15,
      servingLabel: "1 bar",
    });
    expect(result).toContain("energy_unit_confusion");
    // Both would otherwise fire, and the pair reads as noise to an admin.
    expect(result).not.toContain("atwater_mismatch");
  });

  it("carries the implied kcal on the unit-confusion flag", () => {
    const flag = evaluateFoodFlags({
      name: "Muesli bar",
      baseUnit: "g",
      energyKcal: 1669,
      proteinG: 6,
      carbsG: 60,
      fatG: 15,
      servingLabel: "1 bar",
    }).find((f) => f.code === "energy_unit_confusion");
    // The admin's one-click correction writes this number.
    expect(flag?.value).toBeCloseTo(398.9, 1);
  });

  it("does not flag olive oil, which is legitimately at the energy ceiling", () => {
    // 884 kcal and exactly 100 g of fat — both thresholds are exclusive for
    // a reason, and atwater (900) is within tolerance of 884.
    expect(
      codes({
        name: "Olive oil",
        baseUnit: "g",
        energyKcal: 884,
        proteinG: 0,
        carbsG: 0,
        fatG: 100,
        servingLabel: "1 tbsp",
      }),
    ).toEqual([]);
  });
});
