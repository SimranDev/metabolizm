import { ScrollView, StyleSheet } from "react-native";

import { NutritionSummaryCard } from "@/components/log/nutrition-summary-card";
import { PlaceholderScreen } from "@/components/placeholder-screen";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useProfile } from "@/store/profile";

/**
 * TEMPORARY sample data — there is no food-logging feature yet, so nothing real
 * to sum for "consumed today". Shaped exactly like the eventual diary summary so
 * swapping in real data later is a one-line change here; the card itself doesn't
 * know the data is fake.
 */
const SAMPLE_CONSUMED = {
  calories: 422,
  macros: { carbsG: 10, fatG: 5, proteinG: 17.5 },
};

export default function LogScreen() {
  const profile = useProfile((s) => s.profile);

  // Unreachable in practice (the root gate requires onboarding), but fail safe.
  if (!profile) {
    return <PlaceholderScreen title="Log" />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NutritionSummaryCard
          targetCalories={profile.targetCalories}
          consumedCalories={SAMPLE_CONSUMED.calories}
          consumedMacros={SAMPLE_CONSUMED.macros}
        />

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Sample data — food logging is coming soon.
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
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  note: {
    textAlign: "center",
  },
});
