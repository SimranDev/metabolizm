import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { StatNumber } from "@/components/ui/stat-number";
import type { Nutrition } from "@/lib/food";
import { formatGrams } from "@/lib/food/units";
import { Radius, Spacing, useTheme } from "@/theme";

type Props = {
  nutrition: Nutrition;
  /** Serving-size text shown at the top, e.g. "250 Grams" or "1 cup (240 g)". */
  servingLabel: string;
};

const grams = (n?: number) => (n == null ? null : `${formatGrams(n)}g`);
const milligrams = (n?: number) => (n == null ? null : `${Math.round(n)}mg`);
const milligramsPrecise = (n?: number) => (n == null ? null : `${formatGrams(n)}mg`);
const micrograms = (n?: number) => (n == null ? null : `${formatGrams(n)}mcg`);

/**
 * FDA-style Nutrition Facts label for a single chosen amount of food. Calories +
 * the three macros always render; each micronutrient row appears only when USDA
 * supplied that value. Themed (white label / light text; inverted in dark mode).
 */
export function NutritionFacts({ nutrition, servingLabel }: Props) {
  const { colors } = useTheme();
  const hasMicros =
    nutrition.vitaminDMcg != null ||
    nutrition.calciumMg != null ||
    nutrition.ironMg != null ||
    nutrition.potassiumMg != null;

  return (
    <ThemedView type="surface" style={[styles.label, { borderColor: colors.text }]}>
      <ThemedText type="h2" themeColor="text">
        Nutrition Facts
      </ThemedText>
      <View style={[styles.ruleThin, { backgroundColor: colors.text }]} />

      <View style={styles.servingRow}>
        <ThemedText type="smBold">Serving size</ThemedText>
        <ThemedText type="smBold" tabular>
          {servingLabel}
        </ThemedText>
      </View>

      <View style={[styles.ruleHeavy, { backgroundColor: colors.text }]} />

      <View style={styles.caloriesRow}>
        <ThemedText type="h2" themeColor="text">
          Calories
        </ThemedText>
        <StatNumber value={nutrition.calories} />
      </View>

      <View style={[styles.ruleMedium, { backgroundColor: colors.text }]} />

      <ThemedText type="sm" themeColor="textSecondary" style={styles.amountLabel}>
        Amount per serving
      </ThemedText>

      <Fact label="Total Fat" value={grams(nutrition.fatG)} bold />
      <Fact label="Saturated Fat" value={grams(nutrition.saturatedFatG)} indent />
      <Fact label="Trans Fat" value={grams(nutrition.transFatG)} indent />
      <Fact label="Cholesterol" value={milligrams(nutrition.cholesterolMg)} bold />
      <Fact label="Sodium" value={milligrams(nutrition.sodiumMg)} bold />
      <Fact label="Total Carbohydrate" value={grams(nutrition.carbsG)} bold />
      <Fact label="Dietary Fiber" value={grams(nutrition.fiberG)} indent />
      <Fact label="Total Sugars" value={grams(nutrition.sugarsG)} indent />
      <Fact label="Protein" value={grams(nutrition.proteinG)} bold last={!hasMicros} />

      {hasMicros && (
        <>
          <View style={[styles.ruleHeavy, { backgroundColor: colors.text }]} />
          <Fact label="Vitamin D" value={micrograms(nutrition.vitaminDMcg)} />
          <Fact label="Calcium" value={milligrams(nutrition.calciumMg)} />
          <Fact label="Iron" value={milligramsPrecise(nutrition.ironMg)} />
          <Fact label="Potassium" value={milligrams(nutrition.potassiumMg)} last />
        </>
      )}
    </ThemedView>
  );
}

function Fact({
  label,
  value,
  bold,
  indent,
  last,
}: {
  label: string;
  value: string | null;
  bold?: boolean;
  indent?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  if (value == null) return null;
  return (
    <View
      style={[
        styles.factRow,
        indent && styles.factIndent,
        !last && { borderBottomColor: colors.text, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <ThemedText type={bold ? "smBold" : "sm"}>{label}</ThemedText>
      <ThemedText type={bold ? "smBold" : "sm"} tabular>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.s16,
  },
  ruleThin: {
    height: 1,
    marginVertical: Spacing.s4,
  },
  ruleMedium: {
    height: 4,
    marginVertical: Spacing.s4,
  },
  ruleHeavy: {
    height: 8,
    marginVertical: Spacing.s4,
  },
  servingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  caloriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  amountLabel: {
    textAlign: "right",
    marginBottom: Spacing.s4,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: Spacing.s8,
  },
  factIndent: {
    paddingLeft: Spacing.s24,
  },
});
