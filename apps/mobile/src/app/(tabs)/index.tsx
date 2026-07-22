import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { DayStrip } from '@/components/log/day-strip';
import { MealSection } from '@/components/log/meal-section';
import { NutritionSummaryCard } from '@/components/log/nutrition-summary-card';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedView } from '@/components/themed-view';
import { dayKey } from '@/lib/dates';
import { checkDayRollover, useConsumed, useDiary, useMeals } from '@/store/diary';
import { useProfile } from '@/store/profile';
import { BottomTabInset, Spacing } from '@/theme';

/**
 * The Log tab — the landing screen. It owns the `index` route because native
 * tabs always open on `index.tsx` (there is no initial-tab override), and
 * logging is the app's core loop.
 */
export default function LogScreen() {
  const profile = useProfile((s) => s.profile);
  const meals = useMeals();
  const consumed = useConsumed();
  const sync = useDiary((s) => s.sync);
  const currentDate = useDiary((s) => s.currentDate);

  // Paints from MMKV first, then drains the outbox and pulls the delta. Also
  // covers coming back from the add-food modal, so a log made while offline
  // goes out as soon as the connection returns.
  //
  // The rollover check rides along here: AppState covers an app resumed the
  // next morning, this covers one left open through midnight.
  useFocusEffect(
    useCallback(() => {
      checkDayRollover();
      void sync();
    }, [sync]),
  );

  // Unreachable in practice (the root gate requires onboarding), but fail safe.
  if (!profile) {
    return <PlaceholderScreen title="Log" />;
  }

  return (
    <ThemedView style={styles.container}>
      <DayStrip />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NutritionSummaryCard
          targetCalories={profile.targetCalories}
          consumedCalories={consumed.calories}
          consumedMacros={consumed.macros}
          planning={currentDate > dayKey()}
        />

        {meals.map((meal) => (
          <MealSection key={meal.id} meal={meal} />
        ))}
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
    paddingTop: Spacing.s16,
    paddingBottom: BottomTabInset + Spacing.s24,
    gap: Spacing.s24,
  },
});
