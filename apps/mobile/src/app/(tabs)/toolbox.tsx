import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FastingTile } from '@/components/toolbox/fasting-tile';
import { WaterTile } from '@/components/toolbox/water-tile';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-row';
import { TileGrid } from '@/components/ui/stat-tile';
import { ageFromDob, bmi, maintenanceCalories } from '@/lib/health';
import { useFasting } from '@/store/fasting';
import { useProfile } from '@/store/profile';
import { useWater } from '@/store/water';
import { useWeight } from '@/store/weight';
import { BottomTabInset, Spacing } from '@/theme';

import type { Metrics } from '@metabolizm/shared';

/**
 * Toolbox — the drawer of small tools, and the tab that used to be Recipes.
 *
 * The line against Vitals: **Vitals is today's numbers, Toolbox is things you
 * can do.** A tracker introduced here also earns a Vitals tile once it produces
 * a daily figure worth glancing at; a calculator never does, because there is
 * no number of yours for it to show until you open it.
 *
 * Two sections, because a tracker and a calculator are different objects.
 * Trackers carry a live figure, so they get tiles. Calculators are a row list —
 * a tile is shaped around a value, so rendering a converter as one would give
 * it the silhouette of a metric it doesn't have. The rows still show a real
 * number, which is what `SettingsGroup` is for: a summary, not a list of doors.
 *
 * The profile and weight caches are read from MMKV and cost nothing. The water
 * refresh is the one request this tab makes, and it is deliberately on focus
 * rather than at launch — the same way Vitals re-reads weight.
 */
export default function ToolboxScreen() {
  const router = useRouter();
  const profile = useProfile((s) => s.profile);
  const refreshWater = useWater((s) => s.refresh);
  const refreshFasting = useFasting((s) => s.refresh);
  // `profile.weightKg` is the onboarding snapshot and is never updated by a
  // weigh-in; the weight store holds the live number. Same fallback order as
  // profile/index.tsx uses for goal weight.
  const currentKg = useWeight((s) => s.summary?.stats.currentKg ?? null);

  useEffect(() => {
    void refreshWater();
    void refreshFasting();
  }, [refreshWater, refreshFasting]);

  // Both can be logged from the add sheet and from their detail screens;
  // re-read on return so a tile never lags something recorded elsewhere.
  useFocusEffect(
    useCallback(() => {
      void refreshWater();
      void refreshFasting();
    }, [refreshWater, refreshFasting]),
  );

  const weightKg = currentKg ?? profile?.weightKg ?? null;

  const metrics: Metrics | null =
    profile && weightKg !== null
      ? {
          sex: profile.sex,
          ageYears: ageFromDob(new Date(profile.dob)),
          heightCm: profile.heightCm,
          weightKg,
          goalWeightKg: profile.goalWeightKg,
          goal: profile.goal,
          activityLevel: profile.activityLevel,
        }
      : null;

  // `—` rather than a computed zero for an incomplete profile: a maintenance
  // figure of 0 kcal is a confident wrong answer about someone's body.
  const maintenance =
    metrics === null ? '—' : `${Math.round(maintenanceCalories(metrics)).toLocaleString()} kcal`;
  const bmiValue =
    metrics === null ? '—' : bmi(metrics.weightKg, metrics.heightCm).toFixed(1);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <ThemedText type="h1" themeColor="inkStrong">
            Toolbox
          </ThemedText>
          <ThemedText type="sm" themeColor="textSecondary">
            Calculators and converters
          </ThemedText>
        </View>

        <TileGrid>
          <WaterTile />
          <FastingTile />
        </TileGrid>

        <SettingsGroup title="CALCULATORS">
          <SettingsRow
            first
            label="Body & energy"
            value={metrics === null ? '—' : `BMI ${bmiValue} · ${maintenance}`}
            onPress={() => router.push('/body-energy')}
          />
          <SettingsRow
            label="Unit converter"
            value="kg · cm · kJ"
            onPress={() => router.push('/converter')}
          />
        </SettingsGroup>

        <ThemedText type="sm" themeColor="textTertiary" style={styles.footnote}>
          Workout logging and body measurements land here as their log paths do.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.s24,
    paddingBottom: BottomTabInset + Spacing.s24,
    gap: Spacing.s16,
  },
  titleRow: {
    gap: 2,
    paddingTop: Spacing.s8,
  },
  footnote: {
    marginTop: Spacing.s8,
  },
});
