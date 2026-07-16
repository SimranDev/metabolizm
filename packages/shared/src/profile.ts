/**
 * The finalized user profile captured at the end of onboarding. The zustand
 * store that persists it lives in the mobile app (src/store/profile.ts).
 */

import type {
  ActivityLevel,
  Goal,
  HeightUnit,
  Macros,
  PlanId,
  Sex,
  WeightUnit,
} from "./health";

export type Profile = {
  goal: Goal;
  sex: Sex;
  /** ISO date string. */
  dob: string;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activityLevel: ActivityLevel;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  email: string;
  // Snapshot of the chosen plan at completion.
  planId: PlanId;
  targetCalories: number;
  macros: Macros;
};
