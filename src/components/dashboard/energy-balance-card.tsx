import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KCAL_PER_KG } from '@/lib/health';

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
  const theme = useTheme();

  const out = baselineBurn + activeBurn;
  const balance = eaten - out;
  const deficit = balance < 0;
  const fatGrams = Math.round((Math.abs(balance) / KCAL_PER_KG) * 1000);
  const scale = Math.max(eaten, out, 1);

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          ENERGY BALANCE
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          goal {targetCalories.toLocaleString()} cal
        </ThemedText>
      </View>

      <View style={styles.heroRow}>
        <ThemedText style={styles.hero}>
          {deficit ? '−' : '+'}
          {Math.round(Math.abs(balance)).toLocaleString()}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.heroCaption}>
          cal {deficit ? 'deficit' : 'surplus'} so far today
        </ThemedText>
      </View>

      <View
        style={styles.bars}
        accessible
        accessibilityLabel={`${Math.round(eaten)} calories in, ${Math.round(out)} calories out, a ${Math.round(Math.abs(balance))} calorie ${deficit ? 'deficit' : 'surplus'} so far today`}>
        <BalanceBar label="In" value={eaten} scale={scale} color={theme.tint} />
        <BalanceBar label="Out" value={out} scale={scale} color={theme.textSecondary} />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
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
  const theme = useTheme();
  return (
    <View style={styles.barRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
        {label}
      </ThemedText>
      <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[styles.barFill, { width: `${(value / scale) * 100}%`, backgroundColor: color }]}
        />
      </View>
      <ThemedText type="smallBold" style={styles.barValue}>
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
  caps: {
    letterSpacing: 1.2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  hero: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 40,
    lineHeight: 46,
  },
  heroCaption: {
    fontSize: 15,
  },
  bars: {
    gap: Spacing.one,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
