import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type Props = {
  initialGlasses: number;
  goalGlasses: number;
  mlPerGlass: number;
};

const formatLiters = (ml: number) =>
  `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;

/**
 * Tap-to-log hydration: a row of drops, tap one to set the count (tap the last
 * filled drop to undo it). Local state only — a taste of the eventual logger.
 */
export function WaterCard({ initialGlasses, goalGlasses, mlPerGlass }: Props) {
  const theme = useTheme();
  const [glasses, setGlasses] = useState(Math.min(initialGlasses, goalGlasses));

  const onPressGlass = (index: number) => {
    haptics.select();
    setGlasses(index + 1 === glasses ? index : index + 1);
  };

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          WATER
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatLiters(glasses * mlPerGlass)} of {formatLiters(goalGlasses * mlPerGlass)}
        </ThemedText>
      </View>

      <View style={styles.drops}>
        {Array.from({ length: goalGlasses }, (_, i) => {
          const filled = i < glasses;
          return (
            <Pressable
              key={i}
              onPress={() => onPressGlass(i)}
              hitSlop={Spacing.one}
              accessibilityRole="button"
              accessibilityLabel={`Glass ${i + 1} of ${goalGlasses}`}
              accessibilityState={{ selected: filled }}
              style={({ pressed }) => [styles.drop, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'drop.fill', android: 'water_drop' }}
                size={26}
                tintColor={filled ? theme.tint : theme.backgroundSelected}
                fallback={<View />}
              />
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Tap a drop — {glasses} of {goalGlasses} glasses ({mlPerGlass} ml each)
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  caps: {
    letterSpacing: 1.2,
  },
  drops: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  drop: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
