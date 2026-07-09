import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/dashboard/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Macros } from '@/lib/health';

type MacroColor = 'protein' | 'carbs' | 'fat';

type Row = {
  key: keyof Macros;
  label: string;
  icon: SymbolViewProps['name'];
  color: MacroColor;
};

/** Protein first — it's the anchor of every plan (see `macrosFor`). */
const ROWS: Row[] = [
  {
    key: 'proteinG',
    label: 'Protein',
    icon: { ios: 'dumbbell.fill', android: 'fitness_center' },
    color: 'protein',
  },
  { key: 'carbsG', label: 'Carbs', icon: { ios: 'leaf.fill', android: 'eco' }, color: 'carbs' },
  { key: 'fatG', label: 'Fat', icon: { ios: 'drop.fill', android: 'water_drop' }, color: 'fat' },
];

type Props = {
  consumed: Macros;
  targets: Macros;
};

/** Grams consumed vs the plan's macro targets, one labeled bar per macro. */
export function MacrosCard({ consumed, targets }: Props) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          MACROS
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          vs plan targets
        </ThemedText>
      </View>

      {ROWS.map(({ key, label, icon, color }) => {
        const eaten = consumed[key];
        const target = targets[key];
        return (
          <View
            key={key}
            style={styles.row}
            accessible
            accessibilityLabel={`${label}: ${Math.round(eaten)} of ${Math.round(target)} grams`}>
            <View style={styles.rowHeader}>
              <SymbolView name={icon} size={15} tintColor={theme[color]} fallback={<View />} />
              <ThemedText type="smallBold">{label}</ThemedText>
              <View style={styles.spacer} />
              <ThemedText type="smallBold">
                {Math.round(eaten)}
                <ThemedText type="small" themeColor="textSecondary">
                  {' '}
                  / {Math.round(target)} g
                </ThemedText>
              </ThemedText>
            </View>
            <ProgressBar fraction={target > 0 ? eaten / target : 0} color={theme[color]} />
          </View>
        );
      })}
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
  row: {
    gap: Spacing.one,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  spacer: {
    flex: 1,
  },
});
