import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/dashboard/progress-bar';
import type { ScoreFactor } from '@/components/dashboard/sample-data';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  total: number;
  /** Change vs yesterday; positive is up. */
  delta: number;
  factors: readonly ScoreFactor[];
};

/**
 * Composite daily "metabolic score" (Whoop/Oura-style): one number a user can
 * check in a glance, with the contributing factors broken out beside it.
 */
export function ScoreCard({ total, delta, factors }: Props) {
  const theme = useTheme();
  const deltaText = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} vs yesterday`;

  return (
    <Card
      accessible
      accessibilityLabel={`Metabolic score ${total} of 100, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} from yesterday`}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          METABOLIC SCORE
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {deltaText}
        </ThemedText>
      </View>

      <View style={styles.body}>
        <View style={styles.scoreBlock}>
          <ThemedText style={styles.score}>
            {total}
            <ThemedText themeColor="textSecondary" style={styles.outOf}>
              /100
            </ThemedText>
          </ThemedText>
        </View>

        <View style={styles.factors}>
          {factors.map((factor) => (
            <View key={factor.label} style={styles.factor}>
              <View style={styles.factorRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {factor.label}
                </ThemedText>
                <ThemedText type="smallBold">{factor.value}</ThemedText>
              </View>
              <ProgressBar fraction={factor.value / 100} color={theme.tint} height={4} />
            </View>
          ))}
        </View>
      </View>
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
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  scoreBlock: {
    justifyContent: 'center',
  },
  score: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 56,
    lineHeight: 64,
  },
  outOf: {
    fontFamily: Fonts.sans,
    fontSize: 18,
  },
  factors: {
    flex: 1,
    gap: Spacing.two,
  },
  factor: {
    gap: Spacing.half,
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
});
