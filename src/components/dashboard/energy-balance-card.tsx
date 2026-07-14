import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { StatNumber } from '@/components/ui/stat-number';
import { KCAL_PER_KG } from '@/lib/health';
import { Spacing, useTheme } from '@/theme';

type Props = {
  /** Calories eaten so far today. */
  eaten: number;
  /** Baseline (TDEE) calories burned so far today. */
  baselineBurn: number;
  /** Active/exercise calories on top of the baseline. */
  activeBurn: number;
  targetCalories: number;
};

/**
 * Live energy balance — calories in vs calories out *so far today*, not just
 * "remaining vs budget" (that lives on the Log tab). The hero is the running
 * deficit/surplus, with its body-fat equivalent for scale.
 */
export function EnergyBalanceCard({ eaten, baselineBurn, activeBurn, targetCalories }: Props) {
  const { colors } = useTheme();

  const out = baselineBurn + activeBurn;
  const balance = eaten - out;
  const deficit = balance < 0;
  const fatGrams = Math.round((Math.abs(balance) / KCAL_PER_KG) * 1000);
  const scale = Math.max(eaten, out, 1);

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="micro" themeColor="textSecondary">
          Energy balance
        </ThemedText>
        <ThemedText type="sm" themeColor="textSecondary" tabular>
          goal {targetCalories.toLocaleString()} cal
        </ThemedText>
      </View>

      <View style={styles.heroRow}>
        <StatNumber
          value={`${deficit ? '−' : '+'}${Math.round(Math.abs(balance)).toLocaleString()}`}
          suffix={` cal ${deficit ? 'deficit' : 'surplus'} so far today`}
        />
      </View>

      <View
        style={styles.bars}
        accessible
        accessibilityLabel={`${Math.round(eaten)} calories in, ${Math.round(out)} calories out, a ${Math.round(Math.abs(balance))} calorie ${deficit ? 'deficit' : 'surplus'} so far today`}>
        <BalanceBar label="In" value={eaten} scale={scale} color={colors.primary} />
        <BalanceBar label="Out" value={out} scale={scale} color={colors.borderStrong} />
      </View>

      <ThemedText type="sm" themeColor="textSecondary" tabular>
        Out = baseline burn so far + {activeBurn.toLocaleString()} active · ≈ {fatGrams} g of body
        fat
      </ThemedText>
    </Card>
  );
}

function BalanceBar({
  label,
  value,
  scale,
  color,
}: {
  label: string;
  value: number;
  scale: number;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.barRow}>
      <ThemedText type="sm" themeColor="textSecondary" style={styles.barLabel}>
        {label}
      </ThemedText>
      <View style={[styles.barTrack, { backgroundColor: colors.ringTrack }]}>
        <View
          style={[styles.barFill, { width: `${(value / scale) * 100}%`, backgroundColor: color }]}
        />
      </View>
      <ThemedText type="smBold" style={styles.barValue} tabular>
        {Math.round(value).toLocaleString()}
      </ThemedText>
    </View>
  );
}

const BAR_HEIGHT = 10;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.s8,
  },
  bars: {
    gap: Spacing.s4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s8,
  },
  barLabel: {
    width: 28,
  },
  barTrack: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
  },
  barValue: {
    width: 48,
    textAlign: 'right',
  },
});
