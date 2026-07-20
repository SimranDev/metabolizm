/**
 * Pure daily-summary math — no DB access, unit-testable in isolation.
 * The service layer feeds it diary rows and target history; it produces the
 * daily_summaries column values.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Bound on meal_names so a pathological day can't bloat the jsonb row. */
const MEAL_NAMES_CAP = 100;

export type SummaryEntryInput = {
  meal: string;
  name: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: Date;
  deletedAt: Date | null;
};

export type DaySummaryTotals = {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsLogged: number;
  mealNames: string[];
};

/**
 * Aggregate one (user, day)'s diary rows. Soft-deleted entries are excluded;
 * mealsLogged counts distinct meal slots; mealNames collects entry names in
 * log order, deduped.
 */
export function computeDaySummary(
  entries: SummaryEntryInput[],
): DaySummaryTotals {
  const active = entries
    .filter((e) => e.deletedAt === null)
    .sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());

  let energyKcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  const meals = new Set<string>();
  const names: string[] = [];
  const seenNames = new Set<string>();

  for (const entry of active) {
    energyKcal += entry.energyKcal;
    proteinG += entry.proteinG;
    carbsG += entry.carbsG;
    fatG += entry.fatG;
    meals.add(entry.meal);
    if (!seenNames.has(entry.name) && names.length < MEAL_NAMES_CAP) {
      seenNames.add(entry.name);
      names.push(entry.name);
    }
  }

  return {
    energyKcal: round2(energyKcal),
    proteinG: round2(proteinG),
    carbsG: round2(carbsG),
    fatG: round2(fatG),
    mealsLogged: meals.size,
    mealNames: names,
  };
}

