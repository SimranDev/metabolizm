import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Fonts, Spacing } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { useTheme } from "@/hooks/use-theme";
import type { Macros } from "@/lib/health";
import { FontAwesomeFreeSolid, type FontAwesomeFreeSolidIconName } from "@react-native-vector-icons/fontawesome-free-solid";

const KCAL_PER_G = { carbsG: 4, fatG: 9, proteinG: 4 } as const;

/** Outer "pipe" is this much taller than the inner bar (the red wrapper ring). */
const TRACK_HEIGHT = 24;
const BAR_HEIGHT = 80;
const RING = (TRACK_HEIGHT - BAR_HEIGHT) / 2;
/** Extra right-side gap that reveals the red pipe once over budget. */
const OVER_INSET = 12;
const BORDER_RADIUS = 8;

type MacroColor = "carbs" | "fat" | "protein";

type Props = {
  targetCalories: number;
  consumedCalories: number;
  consumedMacros: Macros;
};

/**
 * Today's nutrition summary, kept deliberately compact: hero "remaining
 * calories" stat, a macro-segmented main bar, and a single row of consumed
 * grams per macro. Macro *targets* are intentionally not shown. The bar fills
 * once on mount (built-in `Animated`; instant under OS Reduce Motion).
 *
 * Over budget, the outer track turns red and the colored bar pulls in from the
 * right — a pipe inside a slightly bigger red pipe — instead of recoloring the
 * macro segments. On iOS 26+ the card is real liquid glass; elsewhere it falls
 * back to the flat themed card.
 */
export function NutritionSummaryCard({ targetCalories, consumedCalories, consumedMacros }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  // Held in state (not a ref) per the react-hooks refs rule.
  const [reveal] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: reduceMotion ? 0 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // widths can't run on the native driver
    }).start();
  }, [reveal, reduceMotion]);

  const remaining = Math.round(targetCalories - consumedCalories);
  const over = remaining < 0;

  // Main-bar fill: total macro calories as a share of the daily target; the
  // segments inside split that fill by their calorie contribution.
  const kcal = {
    carbs: consumedMacros.carbsG * KCAL_PER_G.carbsG,
    fat: consumedMacros.fatG * KCAL_PER_G.fatG,
    protein: consumedMacros.proteinG * KCAL_PER_G.proteinG,
  };
  const totalKcal = kcal.carbs + kcal.fat + kcal.protein;
  const fillFraction = over || totalKcal >= targetCalories ? 1 : totalKcal / Math.max(targetCalories, 1);
  const fillWidth = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${fillFraction * 100}%`],
  });

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          CALORIES
        </ThemedText>
        <ThemedText style={styles.eaten}>
          {Math.round(consumedCalories).toLocaleString()}
          <ThemedText themeColor="textSecondary" style={styles.eatenTarget}>
            {" "}
            / {Math.round(targetCalories).toLocaleString()} cal
          </ThemedText>
        </ThemedText>
      </View>

      <View style={styles.heroRow}>
        <ThemedText style={[styles.hero, over && { color: theme.danger }]}>
          {over ? `+${Math.abs(remaining).toLocaleString()}` : remaining.toLocaleString()}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.heroCaption}>
          {over ? "over budget" : "remaining"}
        </ThemedText>
      </View>

      {/* Outer pipe — turns red when over budget. */}
      <View
        accessibilityLabel={`${Math.round(consumedCalories)} of ${Math.round(targetCalories)} calories${over ? ", over budget" : ""}`}
        style={[styles.track, { backgroundColor: over ? theme.danger : theme.backgroundSelected }]}
      >
        {/* Inner bar — pulls in from the right when over, revealing the red pipe. */}
        <View style={[styles.bar, { backgroundColor: theme.backgroundSelected, marginRight: over ? OVER_INSET : 0 }]}>
          <Animated.View style={[styles.fill, { width: fillWidth }]}>
            <View style={{ flex: kcal.carbs, backgroundColor: theme.carbs }} />
            <View style={{ flex: kcal.fat, backgroundColor: theme.fat }} />
            <View style={{ flex: kcal.protein, backgroundColor: theme.protein }} />
          </Animated.View>
        </View>
      </View>

      <View style={styles.macros}>
        <MacroItem label="Carbs" icon="wheat-alt" color="carbs" grams={consumedMacros.carbsG} />
        <MacroItem label="Fat" icon="droplet" color="fat" grams={consumedMacros.fatG} />
        <MacroItem label="Protein" icon="egg" color="protein" grams={consumedMacros.proteinG} />
      </View>
    </Card>
  );
}

const formatG = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));

function MacroItem({
  label,
  icon,
  color,
  grams,
}: {
  label: string;
  icon: FontAwesomeFreeSolidIconName;
  color: MacroColor;
  grams: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.macroItem}>
      <FontAwesomeFreeSolid name={icon} size={15} color={theme[color]} />
      <ThemedText themeColor={color} style={styles.macroText}>
        {formatG(grams)}g {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shared Card defaults to a roomier gap; this summary is deliberately tight.
  card: {
    gap: Spacing.one,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  caps: {
    letterSpacing: 1.2,
  },
  eaten: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  eatenTarget: {
    fontSize: 15,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.two,
  },
  hero: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 44,
    lineHeight: 50,
  },
  heroCaption: {
    fontSize: 16,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: BORDER_RADIUS,
    padding: RING,
    marginTop: Spacing.one,
  },
  bar: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  fill: {
    flexDirection: "row",
    height: "100%",
  },
  macros: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.one,
  },
  macroItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  macroText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
});
