/**
 * The authenticated user's own account row. Distinct from `Profile`, which is
 * the device-local onboarding snapshot — this is what the server stores and
 * what every "today" on the backend is computed against.
 */

import type { UserTargetDto } from "./groups";
import type {
  ActivityLevel,
  Goal,
  HeightUnit,
  PlanId,
  Sex,
  WeightUnit,
} from "./health";

export type MeDto = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** IANA timezone name. Drives entry dates, streaks, and group "today". */
  timezone: string;
  weightUnit: WeightUnit;
};

export type MeResponse = { user: MeDto };

/**
 * The caller's own targets. Same row shape the coach path returns — a user
 * setting their own and a coach setting a client's write the same
 * `user_targets` table, so they deliberately share `UserTargetDto`.
 */
export type MyTargetsResponse = { target: UserTargetDto };

/**
 * The caller's onboarding snapshot — the raw inputs a returning user reviews.
 * `dob` is `YYYY-MM-DD`; `weightKg` is the as-onboarded value (ongoing weigh-ins
 * live in weight_entries). Derived targets/weight-goal are NOT here — they have
 * their own responses.
 */
export type UserProfileDto = {
  goal: Goal;
  sex: Sex;
  dob: string;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number | null;
  activityLevel: ActivityLevel;
  heightUnit: HeightUnit;
  planId: PlanId;
  customWeeklyRateKg: number | null;
  updatedAt: string;
};

/** `profile` is null when the account has no saved onboarding snapshot yet. */
export type MyProfileResponse = { profile: UserProfileDto | null };
