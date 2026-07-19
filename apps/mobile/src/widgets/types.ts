/**
 * The payload pushed from the app to the home-screen widgets on both platforms.
 * Must stay JSON-serializable: on iOS it is written to App Group storage as
 * widget timeline props; on Android it is re-derived inside the headless task.
 *
 * This file is bundled into the iOS widget extension — keep it free of any
 * react/react-native/app imports.
 */

export type MacroProgress = {
  consumedG: number;
  targetG: number;
};

export type WidgetDayData = {
  /** Local YYYY-MM-DD the data was computed for. */
  dateKey: string;
  /** False until onboarding finishes — widgets show a "set up" state. */
  hasProfile: boolean;
  targetCalories: number;
  consumedCalories: number;
  carbs: MacroProgress;
  fat: MacroProgress;
  protein: MacroProgress;
  /** Meals with at least one logged entry today (drives the plate's steam). */
  mealsLogged: number;
};

/** Widget names — must match both config plugin entries in app.json. */
export const WIDGET_NAMES = {
  caloriePace: 'CaloriePace',
  macroBars: 'MacroBars',
  plateRing: 'PlateRing',
} as const;

/** The zeroed payload a fresh day rolls over to (iOS midnight timeline entry). */
export function emptyDay(dateKey: string, base: WidgetDayData): WidgetDayData {
  return {
    dateKey,
    hasProfile: base.hasProfile,
    targetCalories: base.targetCalories,
    consumedCalories: 0,
    carbs: { consumedG: 0, targetG: base.carbs.targetG },
    fat: { consumedG: 0, targetG: base.fat.targetG },
    protein: { consumedG: 0, targetG: base.protein.targetG },
    mealsLogged: 0,
  };
}
