import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveReadout } from '@/components/onboarding/live-readout';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ageFromDob, cmToFtIn } from '@/lib/health';
import { finalizeOnboarding } from '@/lib/onboarding-finalize';
import { buildMetrics, resolveSelectedPlan } from '@/lib/onboarding-metrics';
import { formatWeight } from '@/lib/weight';
import { useOnboarding } from '@/store/onboarding';
import { useWeight } from '@/store/weight';
import type { ActivityLevel, Goal, Sex } from '@metabolizm/shared';
import { Spacing } from '@/theme';

const GOAL_LABEL: Record<Goal, string> = {
  lose: 'Lose weight',
  'gain-muscle': 'Gain muscle',
  recomp: 'Recomposition',
  maintain: 'Maintain',
  'improve-health': 'Improve health',
};
const SEX_LABEL: Record<Sex, string> = { male: 'Male', female: 'Female', other: 'Other' };
const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  very: 'Very active',
  athlete: 'Athlete',
};

/**
 * Shown to a returning user right after sign-in, prefilled from their saved
 * profile (the sign-in screen hydrates the onboarding store). They confirm and
 * enter the app, or edit — "Change my details" walks the same onboarding steps,
 * which end by finalizing this account instead of creating a new one.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const answers = useOnboarding();
  const unit = useWeight((s) => s.unit);
  const [saving, setSaving] = useState(false);

  const metrics = buildMetrics(answers);
  if (!metrics || !answers.dob) {
    // The saved profile was incomplete — fall back to a full setup.
    return (
      <OnboardingScaffold
        progress={1}
        title="Let's finish your details"
        nextLabel="Continue"
        onNext={() => router.replace('/goal')}
        showBack={false}>
        <ThemedText themeColor="textSecondary">
          {"A few details are missing — let's fill them in."}
        </ThemedText>
      </OnboardingScaffold>
    );
  }

  const plan = resolveSelectedPlan(answers, metrics);
  const height =
    answers.heightUnit === 'ftin'
      ? (() => {
          const { ft, in: inches } = cmToFtIn(metrics.heightCm);
          return `${ft}′ ${inches}″`;
        })()
      : `${Math.round(metrics.heightCm)} cm`;

  const confirm = () => {
    setSaving(true);
    // completeOnboarding inside flips the root gate into the app, so there is
    // no navigation to do here; keep the button busy until that happens.
    void finalizeOnboarding(useOnboarding.getState()).catch(() => setSaving(false));
  };

  return (
    <OnboardingScaffold
      progress={1}
      title="Welcome back"
      subtitle="Here's the plan we saved for you. Confirm it, or change anything that's out of date."
      showBack={false}
      footer={
        <View style={styles.actions}>
          <Button
            label={saving ? 'Saving…' : 'Looks good'}
            size="lg"
            fullWidth
            disabled={saving}
            onPress={confirm}
          />
          <Button
            label="Change my details"
            variant="ghost"
            fullWidth
            disabled={saving}
            onPress={() => router.replace('/goal')}
          />
        </View>
      }>
      <LiveReadout
        items={[
          { label: 'Daily target', value: `${plan.targetCalories.toLocaleString()} cal` },
          { label: 'Plan', value: plan.label },
        ]}
      />

      <Card style={styles.card}>
        <Row label="Goal" value={GOAL_LABEL[metrics.goal]} />
        <Row label="Sex" value={SEX_LABEL[metrics.sex]} />
        <Row label="Age" value={`${ageFromDob(new Date(answers.dob))} yrs`} />
        <Row label="Height" value={height} />
        <Row label="Current weight" value={formatWeight(metrics.weightKg, unit)} />
        {metrics.goalWeightKg != null ? (
          <Row label="Goal weight" value={formatWeight(metrics.goalWeightKg, unit)} />
        ) : null}
        <Row label="Activity" value={ACTIVITY_LABEL[metrics.activityLevel]} />
      </Card>
    </OnboardingScaffold>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="body" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.s12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { gap: Spacing.s8 },
});
