import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EnergyBalanceCard } from '@/components/dashboard/energy-balance-card';
import { FastingCard } from '@/components/dashboard/fasting-card';
import { InsightCard } from '@/components/dashboard/insight-card';
import { MacrosCard } from '@/components/dashboard/macros-card';
import { MicrosCard } from '@/components/dashboard/micros-card';
import { SAMPLE } from '@/components/dashboard/sample-data';
import { ScoreCard } from '@/components/dashboard/score-card';
import { StatTile, TileGrid } from '@/components/dashboard/stat-tile';
import { WaterCard } from '@/components/dashboard/water-card';
import { WeekStrip } from '@/components/dashboard/week-strip';
import { WeightCard } from '@/components/dashboard/weight-card';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ageFromDob, bmi, bmiCategory, maintenanceCalories } from '@/lib/health';
import { useProfile } from '@/store/profile';

/**
 * The daily overview. Everything below the fold is SAMPLE data (see
 * [sample-data.ts](../../components/dashboard/sample-data.ts)) — but all the
 * math that *can* be real already is: BMI, maintenance calories, macro targets,
 * and unit formatting come from the profile and the health lib.
 */
export default function DashboardScreen() {
  const profile = useProfile((s) => s.profile);

  // Unreachable in practice (the root gate requires onboarding), but fail safe.
  if (!profile) {
    return <PlaceholderScreen title="Dashboard" />;
  }

  const maintenance = maintenanceCalories({
    sex: profile.sex,
    ageYears: ageFromDob(new Date(profile.dob)),
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goalWeightKg: profile.goalWeightKg,
    goal: profile.goal,
    activityLevel: profile.activityLevel,
  });
  const bmiValue = bmi(profile.weightKg, profile.heightCm);
  const bmiLabel = bmiCategory(bmiValue);

  const { activity, sleep, heart } = SAMPLE;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <ThemedText type="title">Today</ThemedText>
          <StreakPill days={SAMPLE.streakDays} />
        </View>

        <ScoreCard
          total={SAMPLE.score.total}
          delta={SAMPLE.score.delta}
          factors={SAMPLE.score.factors}
        />

        <SectionLabel>Energy</SectionLabel>
        <EnergyBalanceCard
          eaten={SAMPLE.consumed.calories}
          baselineBurn={maintenance * SAMPLE.dayFraction}
          activeBurn={activity.activeCalories}
          targetCalories={profile.targetCalories}
        />
        <WeekStrip calories={SAMPLE.weekCalories} target={profile.targetCalories} />

        <SectionLabel>Nutrition</SectionLabel>
        <MacrosCard consumed={SAMPLE.consumed.macros} targets={profile.macros} />
        <MicrosCard micros={SAMPLE.micros} />
        <WaterCard
          initialGlasses={SAMPLE.water.glasses}
          goalGlasses={SAMPLE.water.goalGlasses}
          mlPerGlass={SAMPLE.water.mlPerGlass}
        />
        <FastingCard
          hoursFasted={SAMPLE.fasting.hoursFasted}
          goalHours={SAMPLE.fasting.goalHours}
          lastMeal={SAMPLE.fasting.lastMeal}
        />

        <SectionLabel>Activity</SectionLabel>
        <TileGrid>
          <StatTile
            icon={{ ios: 'figure.walk', android: 'directions_walk' }}
            label="Steps"
            value={activity.steps.toLocaleString()}
            sub={`of ${activity.stepGoal.toLocaleString()}`}
            progress={activity.steps / activity.stepGoal}
          />
          <StatTile
            icon={{ ios: 'flame.fill', android: 'local_fire_department' }}
            label="Active energy"
            value={`${activity.activeCalories} cal`}
            sub="▲ 32 vs 7-day avg"
          />
          <StatTile
            icon={{ ios: 'figure.run', android: 'directions_run' }}
            label="Exercise"
            value={`${activity.exerciseMinutes} min`}
            sub={`of ${activity.exerciseGoalMinutes} min`}
            progress={activity.exerciseMinutes / activity.exerciseGoalMinutes}
          />
          <StatTile
            icon={{ ios: 'map.fill', android: 'map' }}
            label="Distance"
            value={`${activity.distanceKm} km`}
            sub="walking + running"
          />
        </TileGrid>

        <SectionLabel>Body</SectionLabel>
        <WeightCard
          weightKg={profile.weightKg}
          goalWeightKg={profile.goalWeightKg}
          weightUnit={profile.weightUnit}
        />
        <TileGrid>
          <StatTile
            icon={{ ios: 'figure.arms.open', android: 'accessibility_new' }}
            label="BMI"
            value={bmiValue.toFixed(1)}
            sub={bmiLabel[0].toUpperCase() + bmiLabel.slice(1)}
          />
          <StatTile
            icon={{ ios: 'percent', android: 'percent' }}
            label="Body fat"
            value={`${SAMPLE.bodyFatPct}%`}
            sub="estimated from trend"
          />
        </TileGrid>

        <SectionLabel>Recovery</SectionLabel>
        <TileGrid>
          <StatTile
            icon={{ ios: 'bed.double.fill', android: 'bedtime' }}
            label="Sleep"
            value={sleep.lastNight}
            sub={`quality ${sleep.qualityPct}%`}
          />
          <StatTile
            icon={{ ios: 'heart.fill', android: 'favorite' }}
            label="Resting HR"
            value={`${heart.restingBpm} bpm`}
            sub={`▼ ${Math.abs(heart.restingDelta)} vs 30-day avg`}
          />
          <StatTile
            icon={{ ios: 'waveform.path.ecg', android: 'monitor_heart' }}
            label="HRV"
            value={`${heart.hrvMs} ms`}
            sub={`▲ ${heart.hrvDelta} vs 30-day avg`}
          />
          <StatTile
            icon={{ ios: 'lungs.fill', android: 'air' }}
            label="VO₂ max"
            value={`${heart.vo2Max}`}
            sub="excellent for your age"
          />
        </TileGrid>

        <InsightCard text={SAMPLE.insight} />

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Sample data — logging and Apple Health / Health Connect sync are coming soon.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.section}>
      {children.toUpperCase()}
    </ThemedText>
  );
}

function StreakPill({ days }: { days: number }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={styles.streak}
      accessible
      accessibilityLabel={`${days}-day logging streak`}>
      <SymbolView
        name={{ ios: 'flame.fill', android: 'local_fire_department' }}
        size={16}
        tintColor={theme.carbs}
        fallback={<View />}
      />
      <ThemedText type="smallBold">{days}-day streak</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  section: {
    letterSpacing: 1.2,
    marginTop: Spacing.two,
    marginBottom: -Spacing.two,
  },
  note: {
    textAlign: 'center',
  },
});
