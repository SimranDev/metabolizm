import { ScrollView, StyleSheet } from "react-native";

import { MealSection } from "@/components/log/meal-section";
import { NutritionSummaryCard } from "@/components/log/nutrition-summary-card";
import { PlaceholderScreen } from "@/components/placeholder-screen";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useConsumed, useMeals } from "@/store/diary";
import { useProfile } from "@/store/profile";

export default function LogScreen() {
  const profile = useProfile((s) => s.profile);
  const meals = useMeals();
  const consumed = useConsumed();

  // Unreachable in practice (the root gate requires onboarding), but fail safe.
  if (!profile) {
    return <PlaceholderScreen title="Log" />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NutritionSummaryCard
          targetCalories={profile.targetCalories}
          consumedCalories={consumed.calories}
          consumedMacros={consumed.macros}
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
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
});
