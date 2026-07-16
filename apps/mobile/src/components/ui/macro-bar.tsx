import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { Motion, useTheme } from '@/theme';
import type { Macros } from '@metabolizm/shared';

const KCAL_PER_G = { carbsG: 4, fatG: 9, proteinG: 4 } as const;

/** Ring of outer pipe visible around the inner bar (the over-budget wrapper). */
const RING = 2;
/** Extra right-side gap that reveals the outer pipe once over budget. */
const OVER_INSET = 12;
const BORDER_RADIUS = 8;

type Props = {
  macros: Macros;
  targetCalories: number;
  /** Logged calories (may exceed the macro-derived total); drives over-budget. */
  consumedCalories: number;
  height?: number;
};

/**
 * The macro-segmented calories bar: carbs/fat/protein segments fill the day's
 * budget; over budget, the outer pipe turns red and the inner bar pulls in
 * from the right to reveal it. Fills once on mount (instant under OS Reduce
 * Motion). Macro colors here are an allowed `macro*` role.
 */
export function MacroBar({ macros, targetCalories, consumedCalories, height = 24 }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  // Held in state (not a ref) per the react-hooks refs rule.
  const [reveal] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: reduceMotion ? 0 : Motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // widths can't run on the native driver
    }).start();
  }, [reveal, reduceMotion]);

  const over = consumedCalories > targetCalories;

  // Bar fill: total macro calories as a share of the daily target; the
  // segments inside split that fill by their calorie contribution.
  const kcal = {
    carbs: macros.carbsG * KCAL_PER_G.carbsG,
    fat: macros.fatG * KCAL_PER_G.fatG,
    protein: macros.proteinG * KCAL_PER_G.proteinG,
  };
  const totalKcal = kcal.carbs + kcal.fat + kcal.protein;
  const fillFraction =
    over || totalKcal >= targetCalories ? 1 : totalKcal / Math.max(targetCalories, 1);
  const fillWidth = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${fillFraction * 100}%`],
  });

  return (
    // Outer pipe — turns red when over budget.
    <View
      accessibilityLabel={`${Math.round(consumedCalories)} of ${Math.round(targetCalories)} calories${over ? ', over budget' : ''}`}
      style={[
        styles.track,
        { height, backgroundColor: over ? colors.danger : colors.ringTrack },
      ]}>
      {/* Inner bar — pulls in from the right when over, revealing the red pipe. */}
      <View
        style={[
          styles.bar,
          { backgroundColor: colors.ringTrack, marginRight: over ? OVER_INSET : 0 },
        ]}>
        <Animated.View style={[styles.fill, { width: fillWidth }]}>
          <View style={{ flex: kcal.carbs, backgroundColor: colors.macroCarbs }} />
          <View style={{ flex: kcal.fat, backgroundColor: colors.macroFat }} />
          <View style={{ flex: kcal.protein, backgroundColor: colors.macroProtein }} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: BORDER_RADIUS,
    padding: RING,
  },
  bar: {
    flex: 1,
    borderRadius: BORDER_RADIUS - RING,
    overflow: 'hidden',
  },
  fill: {
    flexDirection: 'row',
    height: '100%',
  },
});
