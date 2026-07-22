/**
 * Assembles the canonical `Metrics` object the health-math core needs from the
 * raw onboarding answers. Returns `null` until every required field is present.
 */

import { ageFromDob, buildCustomPlan, buildPlans, defaultPlanId } from '@/lib/health';
import { localDateKey } from '@/lib/weight';
import type {
  Metrics,
  Plan,
  Profile,
  PutMyProfileInput,
  UserProfileDto,
  WeightUnit,
} from '@metabolizm/shared';
import type { OnboardingAnswers } from '@/store/onboarding';

export function buildMetrics(a: OnboardingAnswers): Metrics | null {
  if (
    !a.sex ||
    !a.dob ||
    a.heightCm == null ||
    a.weightKg == null ||
    !a.goal ||
    !a.activityLevel
  ) {
    return null;
  }
  return {
    sex: a.sex,
    ageYears: ageFromDob(new Date(a.dob)),
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    goalWeightKg: a.goalWeightKg,
    goal: a.goal,
    activityLevel: a.activityLevel,
  };
}

/** Resolve the finalized plan the user picked, honouring a custom pace. */
export function resolveSelectedPlan(a: OnboardingAnswers, metrics: Metrics): Plan {
  const presets = buildPlans(metrics);
  const id = a.selectedPlanId ?? defaultPlanId(metrics.goal);
  if (id === 'custom' && a.customWeeklyRateKg != null) {
    return buildCustomPlan(metrics, a.customWeeklyRateKg);
  }
  return presets.find((p) => p.id === id) ?? presets[0];
}

/**
 * The finalized profile as the `PUT /users/me/profile` payload. `dob` is
 * converted from its stored ISO datetime to a LOCAL `YYYY-MM-DD` (via
 * `localDateKey`) so the calendar date matches what the user picked rather than
 * shifting a day when the UTC offset crosses midnight. `customWeeklyRateKg`
 * isn't on `Profile`, so it's passed separately from the onboarding answers.
 */
export function profileInputFromProfile(
  p: Profile,
  customWeeklyRateKg?: number,
): PutMyProfileInput {
  return {
    goal: p.goal,
    sex: p.sex,
    dob: localDateKey(new Date(p.dob)),
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    goalWeightKg: p.goalWeightKg ?? null,
    activityLevel: p.activityLevel,
    heightUnit: p.heightUnit,
    planId: p.planId,
    customWeeklyRateKg: customWeeklyRateKg ?? null,
  };
}

/**
 * Server profile → onboarding-store answers, so a returning user's review and
 * edit screens reuse the same store the onboarding steps read.
 *
 * `dob` comes back as `YYYY-MM-DD`; it's rebuilt at LOCAL midnight (not
 * `new Date("YYYY-MM-DD")`, which is UTC and shifts the day for negative
 * offsets) so the picker shows the date the user actually chose. `weightUnit`
 * lives on the account, not the profile, so it's passed in by the caller.
 */
export function answersFromProfile(
  p: UserProfileDto,
  weightUnit: WeightUnit,
): Partial<OnboardingAnswers> {
  const [y, m, d] = p.dob.split('-').map(Number);
  return {
    goal: p.goal,
    sex: p.sex,
    dob: new Date(y, m - 1, d).toISOString(),
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    goalWeightKg: p.goalWeightKg ?? undefined,
    activityLevel: p.activityLevel,
    selectedPlanId: p.planId,
    customWeeklyRateKg: p.customWeeklyRateKg ?? undefined,
    weightUnit,
    heightUnit: p.heightUnit,
  };
}
