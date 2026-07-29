/**
 * In-progress onboarding answers. Persisted to AsyncStorage so a mid-flow app
 * kill resumes where the user left off. Cleared once onboarding completes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  ActivityLevel,
  Goal,
  HeightUnit,
  PlanId,
  Sex,
  WeightUnit,
} from '@metabolizm/shared';

import type { ExerciseBand, NeatLevel } from '@/lib/health';

export type OnboardingAnswers = {
  goal?: Goal;
  sex?: Sex;
  /** ISO date string. */
  dob?: string;
  heightCm?: number;
  weightKg?: number;
  goalWeightKg?: number;
  /**
   * The two raw activity answers. Deliberately device-local: they are collapsed
   * into `activityLevel` by `activityLevelFrom`, and only that derived value
   * reaches `Profile`, the API and the database. A user hydrating a profile on a
   * new device therefore sees the derived level rather than these two answers,
   * which is a fair trade for not versioning a shared schema over a nicety.
   */
  neatLevel?: NeatLevel;
  exerciseBand?: ExerciseBand;
  activityLevel?: ActivityLevel;
  selectedPlanId?: PlanId;
  /** Signed weekly rate (kg) when the Custom plan is chosen. */
  customWeeklyRateKg?: number;
  /** Display-unit preferences, persisted app-wide once set. */
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
};

type OnboardingState = OnboardingAnswers & {
  set: (patch: Partial<OnboardingAnswers>) => void;
  reset: () => void;
};

const initial: OnboardingAnswers = {
  weightUnit: 'kg',
  heightUnit: 'cm',
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      reset: () => set(initial),
    }),
    {
      name: 'metabolizm-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, reset: _reset, ...answers }) => answers,
    },
  ),
);
