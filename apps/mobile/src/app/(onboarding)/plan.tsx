import { Slider } from '@expo/ui/community/slider';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LiveReadout } from '@/components/onboarding/live-readout';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, useTheme } from '@/theme';
import {
  buildCustomPlan,
  buildPlans,
  CALORIE_FLOOR,
  defaultPlanId,
  maintenanceCalories,
} from '@/lib/health';
import type { Plan, PlanId } from '@metabolizm/shared';
import { getToken } from '@/lib/auth';
import { finalizeOnboarding } from '@/lib/onboarding-finalize';
import { buildMetrics } from '@/lib/onboarding-metrics';
import { stepProgress } from '@/lib/onboarding-steps';
import { useOnboarding } from '@/store/onboarding';

const roundCals = (n: number) => Math.round(n).toLocaleString();
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function PlanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const answers = useOnboarding();
  const metrics = buildMetrics(answers);

  const [selectedId, setSelectedId] = useState<PlanId>(
    answers.selectedPlanId ?? (answers.goal ? defaultPlanId(answers.goal) : 'steady'),
  );

  // Direction of change: negative = lose, positive = gain, 0 = maintain.
  const direction = metrics
    ? metrics.goalWeightKg != null
      ? Math.sign(metrics.goalWeightKg - metrics.weightKg)
      : metrics.goal === 'gain-muscle'
        ? 1
        : metrics.goal === 'lose'
          ? -1
          : 0
    : 0;

  const [customRate, setCustomRate] = useState<number>(
    answers.customWeeklyRateKg ?? direction * 0.5,
  );

  if (!metrics) {
    // Shouldn't happen — every prior step is required — but fail safe.
    return (
      <OnboardingScaffold
        progress={stepProgress('plan')}
        title="Let's finish your details"
        onNext={() => router.replace('/goal')}
        nextLabel="Go back">
        <ThemedText themeColor="textSecondary">Some details are missing.</ThemedText>
      </OnboardingScaffold>
    );
  }

  const presets = buildPlans(metrics);
  const maintenance = Math.round(maintenanceCalories(metrics));
  const showCustom = direction !== 0;

  const selectedPlan: Plan =
    selectedId === 'custom' && showCustom
      ? buildCustomPlan(metrics, customRate)
      : (presets.find((p) => p.id === selectedId) ?? presets[0]);

  const onContinue = async () => {
    answers.set({
      selectedPlanId: selectedPlan.id,
      customWeeklyRateKg: selectedPlan.id === 'custom' ? customRate : undefined,
    });
    // A returning user editing their details is already signed in — finalize
    // and enter the app rather than sending them to create another account.
    // A first-time user has no session, so they go on to sign-up.
    if (await getToken()) {
      await finalizeOnboarding(useOnboarding.getState());
    } else {
      router.push('/sign-up');
    }
  };

  return (
    <OnboardingScaffold
      progress={stepProgress('plan')}
      title="Choose your pace"
      subtitle={`Maintenance is about ${maintenance.toLocaleString()} cal/day. The pace you pick sets your daily calories — the finish date follows from it.`}
      onNext={onContinue}
      nextLabel="This looks good">
      <OutcomeCards plan={selectedPlan} />

      {presets.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          selected={selectedId === plan.id}
          onPress={() => setSelectedId(plan.id)}
        />
      ))}

      {showCustom ? (
        <ThemedView
          type="surfaceSunken"
          style={[
            styles.card,
            { borderColor: selectedId === 'custom' ? colors.focusRing : 'transparent' },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === 'custom' }}
            onPress={() => setSelectedId('custom')}
            style={styles.cardHeader}>
            <View style={styles.cardText}>
              <ThemedText type="smBold" style={styles.cardLabel}>
                Custom
              </ThemedText>
              <ThemedText type="sm" themeColor="textSecondary">
                Set your own weekly pace
              </ThemedText>
            </View>
            {selectedId === 'custom' ? (
              <ThemedText type="smBold" tabular style={{ color: colors.primary }}>
                {roundCals(selectedPlan.targetCalories)} cal
              </ThemedText>
            ) : null}
          </Pressable>

          {selectedId === 'custom' ? (
            <View style={styles.sliderWrap}>
              <Slider
                value={Math.abs(customRate)}
                minimumValue={0.1}
                maximumValue={1.0}
                step={0.05}
                minimumTrackTintColor={colors.accent}
                onValueChange={(v) => setCustomRate(direction * Math.round(v * 100) / 100)}
                style={styles.slider}
              />
              <ThemedText type="sm" themeColor="textSecondary" style={styles.sliderLabel}>
                {`${direction < 0 ? 'Lose' : 'Gain'} ~${Math.abs(customRate).toFixed(2)} kg/week`}
                {selectedPlan.projectedDate
                  ? ` · reach goal ~${fmtDate(selectedPlan.projectedDate)}`
                  : ''}
              </ThemedText>
            </View>
          ) : null}
        </ThemedView>
      ) : null}

      <LiveReadout
        items={[
          { label: 'Protein', value: `${selectedPlan.macros.proteinG} g` },
          { label: 'Carbs', value: `${selectedPlan.macros.carbsG} g` },
          { label: 'Fat', value: `${selectedPlan.macros.fatG} g` },
        ]}
      />

      {selectedPlan.clamped ? (
        <ThemedText type="sm" themeColor="dangerText">
          Adjusted up to a safe minimum of {CALORIE_FLOOR[metrics.sex].toLocaleString()} cal/day.
        </ThemedText>
      ) : null}
      {selectedPlan.exceedsSafeRate ? (
        <ThemedText type="sm" themeColor="dangerText">
          This pace is faster than generally recommended (about 1% of bodyweight per week).
        </ThemedText>
      ) : null}

      <Derivation plan={selectedPlan} maintenance={maintenance} weightKg={metrics.weightKg} />

      {selectedPlan.projectedDate ? (
        <ThemedText type="sm" themeColor="textSecondary" style={styles.disclaimer}>
          That date is an optimistic estimate — it assumes your metabolism holds steady and you hit
          every target. Plan for it to take a few weeks longer, and treat progress as the win.
        </ThemedText>
      ) : null}

      <ThemedText type="sm" themeColor="textSecondary" style={styles.disclaimer}>
        Estimates only, not medical advice. Check with a healthcare professional before making big
        changes.
      </ThemedText>
    </OnboardingScaffold>
  );
}

/**
 * The two numbers the pace actually produces, kept together and updating live as
 * the selection changes: the calories you eat, and the date that falls out of
 * them. Deliberately in that order — the budget is the commitment, the date is a
 * consequence.
 */
function OutcomeCards({ plan }: { plan: Plan }) {
  const { colors } = useTheme();
  return (
    <View style={styles.outcomes}>
      <ThemedView type="surfaceSunken" style={[styles.outcome, { borderColor: colors.focusRing }]}>
        <ThemedText type="statSm" tabular style={{ color: colors.primary }}>
          {roundCals(plan.targetCalories)}
        </ThemedText>
        <ThemedText type="micro" themeColor="textSecondary">
          daily calories
        </ThemedText>
      </ThemedView>
      <ThemedView type="surfaceSunken" style={styles.outcome}>
        <ThemedText type="statSm">{plan.projectedDate ? fmtDate(plan.projectedDate) : '—'}</ThemedText>
        <ThemedText type="micro" themeColor="textSecondary">
          {plan.projectedDate ? 'estimated finish' : 'no end date'}
        </ThemedText>
      </ThemedView>
    </View>
  );
}

/**
 * Shows the working behind the target. Every number here already exists on the
 * `Plan`; nothing is recomputed for display.
 */
function Derivation({
  plan,
  maintenance,
  weightKg,
}: {
  plan: Plan;
  maintenance: number;
  weightKg: number;
}) {
  const [open, setOpen] = useState(false);
  const delta = Math.round(plan.targetCalories - maintenance);

  const lines = [
    `Maintenance — about ${maintenance.toLocaleString()} cal/day, from your height, weight, age, sex and activity.`,
    plan.weeklyRateKg === 0
      ? 'Pace — holding steady, so no adjustment is applied.'
      : `Pace — ${Math.abs(plan.weeklyRateKg).toFixed(2)} kg/week works out to ${delta > 0 ? '+' : ''}${delta.toLocaleString()} cal/day.`,
    `Daily target — ${roundCals(plan.targetCalories)} cal/day.`,
    `Macros — protein ${plan.macros.proteinG} g (about ${(plan.macros.proteinG / weightKg).toFixed(1)} g per kg), fat ${plan.macros.fatG} g, and carbs fill the rest.`,
  ];

  return (
    <View style={styles.derivation}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)}>
        <ThemedText type="smBold" themeColor="textSecondary" style={styles.disclaimer}>
          {open ? 'Hide the working' : 'How was this worked out?'}
        </ThemedText>
      </Pressable>
      {open
        ? lines.map((line) => (
            <ThemedText key={line} type="sm" themeColor="textSecondary">
              {line}
            </ThemedText>
          ))
        : null}
    </View>
  );
}

function PlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: Plan;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="surfaceSunken"
        style={[
          styles.card,
          styles.cardHeader,
          { borderColor: selected ? colors.focusRing : 'transparent' },
        ]}>
        <View style={styles.cardText}>
          <ThemedText type="smBold" style={styles.cardLabel}>
            {plan.label}
          </ThemedText>
          <ThemedText type="sm" themeColor="textSecondary">
            {plan.description}
            {plan.projectedDate ? ` · reach goal ~${fmtDate(plan.projectedDate)}` : ''}
          </ThemedText>
        </View>
        <ThemedText type="smBold" tabular style={[styles.cals, selected && { color: colors.primary }]}>
          {roundCals(plan.targetCalories)}
          {'\n'}
          <ThemedText type="sm" themeColor="textSecondary">
            cal/day
          </ThemedText>
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.s16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s16,
  },
  cardText: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 15 },
  cals: { fontSize: 20, textAlign: 'right' },
  outcomes: { flexDirection: 'row', gap: Spacing.s12 },
  outcome: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: Spacing.s16,
    gap: 2,
    alignItems: 'center',
  },
  derivation: { gap: Spacing.s8 },
  sliderWrap: { marginTop: Spacing.s16, gap: Spacing.s8 },
  slider: { height: 40 },
  sliderLabel: { textAlign: 'center' },
  disclaimer: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
