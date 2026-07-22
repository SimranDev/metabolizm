/**
 * Committing a finished onboarding to the account + device.
 *
 * One place that turns the onboarding answers into the stored `Profile` and
 * pushes everything server-side, shared by three callers so they can't drift:
 * the sign-up screen (a brand-new account), the plan step and the review screen
 * (a returning user who edited or confirmed their saved details).
 *
 * It writes all three server records the app reads back on the next sign-in:
 * the raw inputs (`putMyProfile`), the calorie/macro plan (`putMyTargets`), and
 * the goal weight (`setGoal`) — the last of which onboarding never persisted
 * before. Every push is fire-and-forget: a failed write must not trap the user
 * on the onboarding side of the gate. `completeOnboarding` flips the root gate
 * into the app.
 */

import { usersApi } from '@/lib/api';
import {
  buildMetrics,
  profileInputFromProfile,
  resolveSelectedPlan,
} from '@/lib/onboarding-metrics';
import { todayKey } from '@/store/diary';
import { useOnboarding, type OnboardingAnswers } from '@/store/onboarding';
import { useProfile } from '@/store/profile';
import { useWeight } from '@/store/weight';
import type { Profile } from '@metabolizm/shared';

export async function finalizeOnboarding(
  answers: OnboardingAnswers,
  email?: string,
): Promise<void> {
  const metrics = buildMetrics(answers);
  if (!metrics || !answers.dob) return;
  const plan = resolveSelectedPlan(answers, metrics);

  // The sign-up path already has the fresh account's email; the returning-user
  // paths look it up from the session.
  const resolvedEmail =
    email ??
    (await usersApi
      .getMe()
      .then((r) => r.user.email)
      .catch(() => ''));

  const profile: Profile = {
    goal: metrics.goal,
    sex: metrics.sex,
    dob: answers.dob,
    heightCm: metrics.heightCm,
    weightKg: metrics.weightKg,
    goalWeightKg: metrics.goalWeightKg,
    activityLevel: metrics.activityLevel,
    weightUnit: answers.weightUnit,
    heightUnit: answers.heightUnit,
    email: resolvedEmail,
    planId: plan.id,
    targetCalories: plan.targetCalories,
    macros: plan.macros,
  };

  usersApi.pushDeviceTimezone();
  void usersApi
    .putMyTargets({
      effectiveFrom: todayKey(),
      energyKcal: plan.targetCalories,
      proteinG: plan.macros.proteinG,
      carbsG: plan.macros.carbsG,
      fatG: plan.macros.fatG,
    })
    .catch(() => {});
  void usersApi
    .putMyProfile(profileInputFromProfile(profile, answers.customWeeklyRateKg))
    .catch(() => {});
  if (profile.goalWeightKg != null) {
    // The server derives the starting weight from the latest weigh-in and
    // rejects the goal when there is none, so send the onboarding weight only
    // when this account has no weigh-ins yet.
    const hasWeighIns = useWeight.getState().entries.length > 0;
    void useWeight
      .getState()
      .setGoal({
        targetWeightKg: profile.goalWeightKg,
        ...(hasWeighIns ? null : { startingWeightKg: profile.weightKg }),
      })
      .catch(() => {});
  }

  useProfile.getState().completeOnboarding(profile);
  useOnboarding.getState().reset();
}
