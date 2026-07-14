import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { MacroBar } from "@/components/ui/macro-bar";
import { StatNumber } from "@/components/ui/stat-number";
import { formatGrams } from "@/lib/food/units";
import type { Macros } from "@/lib/health";
import { macroTextColor, Spacing, useTheme, type MacroKind } from "@/theme";
import { FontAwesomeFreeSolid, type FontAwesomeFreeSolidIconName } from "@react-native-vector-icons/fontawesome-free-solid";

type Props = {
  targetCalories: number;
  consumedCalories: number;
  consumedMacros: Macros;
};

/**
 * Today's nutrition summary, kept deliberately compact: hero "remaining
 * calories" stat, a macro-segmented main bar, and a single row of consumed
 * grams per macro. Macro *targets* are intentionally not shown.
 */
export function NutritionSummaryCard({ targetCalories, consumedCalories, consumedMacros }: Props) {
  const remaining = Math.round(targetCalories - consumedCalories);
  const over = remaining < 0;

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <ThemedText type="micro" themeColor="textSecondary">
          Calories
        </ThemedText>
        <ThemedText type="smBold" tabular>
          {Math.round(consumedCalories).toLocaleString()}
          <ThemedText type="sm" themeColor="textSecondary" tabular>
            {" "}
            / {Math.round(targetCalories).toLocaleString()} cal
          </ThemedText>
        </ThemedText>
      </View>

      <View style={styles.heroRow}>
        <StatNumber
          value={over ? `+${Math.abs(remaining).toLocaleString()}` : remaining.toLocaleString()}
          suffix={over ? " over budget" : " remaining"}
          size="xl"
          color={over ? "dangerText" : "inkStrong"}
        />
      </View>

      <View style={styles.barWrap}>
        <MacroBar
          macros={consumedMacros}
          targetCalories={targetCalories}
          consumedCalories={consumedCalories}
        />
      </View>

      <View style={styles.macros}>
        <MacroItem label="Carbs" icon="wheat-alt" macro="carbs" grams={consumedMacros.carbsG} />
        <MacroItem label="Fat" icon="droplet" macro="fat" grams={consumedMacros.fatG} />
        <MacroItem
          label="Protein"
          icon="egg"
          macro="protein"
          grams={consumedMacros.proteinG}
        />
      </View>
    </Card>
  );
}

function MacroItem({
  label,
  icon,
  macro,
  grams,
}: {
  label: string;
  icon: FontAwesomeFreeSolidIconName;
  macro: MacroKind;
  grams: number;
}) {
  const { colors } = useTheme();
  const color = macroTextColor(colors, macro);
  return (
    <View style={styles.macroItem}>
      <FontAwesomeFreeSolid name={icon} size={15} color={color} />
      <ThemedText type="smBold" tabular style={{ color }}>
        {formatGrams(grams)}g {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shared Card defaults to a roomier gap; this summary is deliberately tight.
  card: {
    gap: Spacing.s4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.s8,
  },
  barWrap: {
    marginTop: Spacing.s4,
  },
  macros: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.s4,
  },
  macroItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.s4,
  },
});
