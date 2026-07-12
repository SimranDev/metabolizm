import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Nutrition } from "@/lib/food";

type Props = {
  nutrition: Nutrition;
  /** Serving-size text shown at the top, e.g. "250 Grams" or "1 cup (240 g)". */
  servingLabel: string;
};

const formatG = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));

const grams = (n?: number) => (n == null ? null : `${formatG(n)}g`);
const milligrams = (n?: number) => (n == null ? null : `${Math.round(n)}mg`);
const milligramsPrecise = (n?: number) => (n == null ? null : `${formatG(n)}mg`);
const micrograms = (n?: number) => (n == null ? null : `${formatG(n)}mcg`);

/**
 * FDA-style Nutrition Facts label for a single chosen amount of food. Calories +
 * the three macros always render; each micronutrient row appears only when USDA
 * supplied that value. Themed (white label / light text; inverted in dark mode).
 */
export function NutritionFacts({ nutrition, servingLabel }: Props) {
  const theme = useTheme();
  const hasMicros =
    nutrition.vitaminDMcg != null ||
    nutrition.calciumMg != null ||
    nutrition.ironMg != null ||
    nutrition.potassiumMg != null;

  return (
    <ThemedView type="background" style={[styles.label, { borderColor: theme.text }]}>
      <ThemedText style={styles.title}>Nutrition Facts</ThemedText>
      <View style={[styles.ruleThin, { backgroundColor: theme.text }]} />

      <View style={styles.servingRow}>
        <ThemedText type="smallBold">Serving size</ThemedText>
        <ThemedText type="smallBold">{servingLabel}</ThemedText>
      </View>

      <View style={[styles.ruleHeavy, { backgroundColor: theme.text }]} />

      <View style={styles.caloriesRow}>
        <ThemedText style={styles.caloriesLabel}>Calories</ThemedText>
        <ThemedText style={styles.caloriesValue}>{nutrition.calories.toLocaleString()}</ThemedText>
      </View>

      <View style={[styles.ruleMedium, { backgroundColor: theme.text }]} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.amountLabel}>
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
          <View style={[styles.ruleHeavy, { backgroundColor: theme.text }]} />
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
  const theme = useTheme();
  if (value == null) return null;
  return (
    <View
      style={[
        styles.factRow,
        indent && styles.factIndent,
        !last && { borderBottomColor: theme.text, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <ThemedText type={bold ? "smallBold" : "small"}>{label}</ThemedText>
      <ThemedText type={bold ? "smallBold" : "small"}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.three,
  },
  title: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 26,
    lineHeight: 32,
  },
  ruleThin: {
    height: 1,
    marginVertical: Spacing.one,
  },
  ruleMedium: {
    height: 4,
    marginVertical: Spacing.one,
  },
  ruleHeavy: {
    height: 8,
    marginVertical: Spacing.one,
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
  caloriesLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  caloriesValue: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 40,
    lineHeight: 46,
  },
  amountLabel: {
    textAlign: "right",
    marginBottom: Spacing.one,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: Spacing.two,
  },
  factIndent: {
    paddingLeft: Spacing.four,
  },
});
