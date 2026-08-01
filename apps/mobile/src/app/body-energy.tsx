import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LiveReadout } from '@/components/onboarding/live-readout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatNumber } from '@/components/ui/stat-number';
import {
  ACTIVITY_MULTIPLIERS,
  ageFromDob,
  bmi,
  bmiCategory,
  maxHealthyWeightKg,
  mifflinStJeorBmr,
  minHealthyWeightKg,
  safeWeeklyRateKg,
  tdee,
  type BmiCategory,
} from '@/lib/health';
import { formatWeight } from '@/lib/weight';
import { useProfile } from '@/store/profile';
import { useWeight } from '@/store/weight';
import { Radius, Spacing, useTheme } from '@/theme';

import type { ActivityLevel } from '@metabolizm/shared';

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  very: 'Very active',
  athlete: 'Athlete',
};

const CATEGORY_LABEL: Record<BmiCategory, string> = {
  underweight: 'Underweight',
  normal: 'Healthy',
  overweight: 'Overweight',
  obese: 'Obese',
};

const ACTIVITY_ORDER: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'athlete'];

/**
 * Body & energy — BMI, BMR and TDEE for the signed-in profile.
 *
 * Every number here comes from `lib/health/calc.ts`, which has been in the tree
 * since onboarding was built and until now had exactly one caller. The point of
 * this screen is that those figures stop being a thing you see once at signup
 * and never again.
 *
 * It stores nothing. Activity level is local state seeded from the profile so
 * the TDEE can be pushed around — "what would I burn if I trained more" is the
 * question people actually bring to a TDEE calculator — but changing it here
 * does not rewrite the profile or the calorie target. That edit belongs on the
 * screen that owns it, where it also re-runs the plan.
 *
 * Bodyweight is read from the weight store, not `profile.weightKg`, which is
 * the onboarding snapshot and never moves after a weigh-in.
 */
export default function BodyEnergyScreen() {
  const profile = useProfile((s) => s.profile);
  const currentKg = useWeight((s) => s.summary?.stats.currentKg ?? null);
  const unit = useWeight((s) => s.unit);
  // Null until touched, then the user's choice — seeding state from `profile`
  // directly would freeze at whatever it held on first render.
  const [picked, setPicked] = useState<ActivityLevel | null>(null);

  const weightKg = currentKg ?? profile?.weightKg ?? null;

  if (!profile || weightKg === null) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title="Body & energy" />
        <View style={styles.content}>
          <ThemedText type="body" themeColor="textSecondary">
            These figures need your height, date of birth and a weight. Finish setting up your
            profile and they will fill in.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const activityLevel = picked ?? profile.activityLevel;
  const ageYears = ageFromDob(new Date(profile.dob));

  const bmrValue = mifflinStJeorBmr({
    sex: profile.sex,
    weightKg,
    heightCm: profile.heightCm,
    ageYears,
  });
  const tdeeValue = tdee(bmrValue, activityLevel);
  const bmiValue = bmi(weightKg, profile.heightCm);
  const category = bmiCategory(bmiValue);

  const minKg = minHealthyWeightKg(profile.heightCm);
  const maxKg = maxHealthyWeightKg(profile.heightCm);
  const weeklyKg = safeWeeklyRateKg(weightKg);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Body & energy" subtitle={`${formatWeight(weightKg, unit)} · ${ageYears} yrs`} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <StatNumber value={Math.round(tdeeValue).toLocaleString()} size="md" />
            <ThemedText type="h3" themeColor="textSecondary">
              kcal / day
            </ThemedText>
          </View>
          <ThemedText type="body" themeColor="textSecondary">
            What you burn at {ACTIVITY_LABEL[activityLevel].toLowerCase()} — eat this to hold your
            weight.
          </ThemedText>
        </View>

        <LiveReadout
          items={[
            { label: 'BMI', value: bmiValue.toFixed(1) },
            {
              label: 'CATEGORY',
              value: CATEGORY_LABEL[category],
              tone: category === 'normal' ? 'default' : 'warn',
            },
            { label: 'BMR', value: `${Math.round(bmrValue).toLocaleString()}` },
          ]}
        />

        <Card>
          <ThemedText type="smBold" themeColor="inkStrong">
            Activity
          </ThemedText>
          <ThemedText type="sm" themeColor="textSecondary">
            Try another level to see how the estimate moves. Your saved profile is unchanged.
          </ThemedText>
          {/* Wrapping chips rather than a 5-way Segmented: five segments on a
              phone truncate their labels, and the control that swings the
              headline number by 700 kcal should not be the one guessing at
              what it says. */}
          <View style={styles.chips}>
            {ACTIVITY_ORDER.map((level) => (
              <ChoiceChip
                key={level}
                label={ACTIVITY_LABEL[level]}
                selected={level === activityLevel}
                onPress={() => setPicked(level)}
              />
            ))}
          </View>
          <View style={styles.rows}>
            <Row label="Basal rate (BMR)" value={`${Math.round(bmrValue).toLocaleString()} kcal`} />
            <Row label="Activity factor" value={`× ${ACTIVITY_MULTIPLIERS[activityLevel]}`} />
            <Row
              label="Maintenance (TDEE)"
              value={`${Math.round(tdeeValue).toLocaleString()} kcal`}
              strong
            />
            <Row
              label="Your daily target"
              value={`${profile.targetCalories.toLocaleString()} kcal`}
            />
          </View>
        </Card>

        <Card>
          <ThemedText type="smBold" themeColor="inkStrong">
            Healthy weight range
          </ThemedText>
          <ThemedText type="sm" themeColor="textSecondary">
            The span that sits in the healthy BMI band at {profile.heightCm} cm.
          </ThemedText>
          <View style={styles.rows}>
            <Row label="Range" value={`${formatWeight(minKg, unit)} – ${formatWeight(maxKg, unit)}`} />
            <Row label="You are" value={formatWeight(weightKg, unit)} strong />
            <Row label="Safe rate of change" value={`${formatWeight(weeklyKg, unit)} / week`} />
          </View>
        </Card>

        <ThemedText type="sm" themeColor="textTertiary" style={styles.footnote}>
          Estimates from the Mifflin-St Jeor equation. BMI does not distinguish muscle from fat and
          reads high for a lot of trained people. Not medical advice.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.surfaceSunken : 'transparent',
          // Selected = 2px focusRing border, the house rule for a chosen control.
          borderColor: selected ? colors.focusRing : colors.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="sm" themeColor={selected ? 'inkStrong' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="sm" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText
        type={strong ? 'smBold' : 'sm'}
        themeColor={strong ? 'inkStrong' : 'text'}
        tabular
        numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.s20,
    paddingBottom: Spacing.s48,
    gap: Spacing.s16,
  },
  hero: {
    gap: Spacing.s4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.s8,
    flexWrap: 'wrap',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s8,
    marginTop: Spacing.s4,
  },
  chip: {
    paddingHorizontal: Spacing.s12,
    paddingVertical: Spacing.s8,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  rows: {
    gap: Spacing.s8,
    marginTop: Spacing.s4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.s12,
  },
  rowLabel: {
    flex: 1,
  },
  footnote: {
    marginTop: Spacing.s4,
  },
  pressed: {
    opacity: 0.7,
  },
});
