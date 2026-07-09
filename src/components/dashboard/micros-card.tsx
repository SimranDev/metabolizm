import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/dashboard/progress-bar';
import type { MicroSample } from '@/components/dashboard/sample-data';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  micros: readonly MicroSample[];
};

/**
 * Micronutrient watch — the "micro" half of the app's core tracking. Two row
 * kinds: `goal` rows fill toward a target (tint), `limit` rows track headroom
 * under a cap (neutral, turning red once ~90% of the cap is gone).
 */
export function MicrosCard({ micros }: Props) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          MICRONUTRIENTS
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          vs daily targets
        </ThemedText>
      </View>

      {micros.map((micro) => {
        const fraction = micro.target > 0 ? micro.consumed / micro.target : 0;
        const isLimit = micro.kind === 'limit';
        const fill = isLimit
          ? fraction >= 0.9
            ? theme.danger
            : theme.textSecondary
          : theme.tint;
        return (
          <View
            key={micro.label}
            style={styles.row}
            accessible
            accessibilityLabel={`${micro.label}: ${micro.consumed} of ${micro.target} ${micro.unit} ${isLimit ? 'limit' : 'goal'}`}>
            <View style={styles.rowHeader}>
              <ThemedText type="smallBold">{micro.label}</ThemedText>
              {isLimit && (
                <View style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText themeColor="textSecondary" style={styles.tagText}>
                    LIMIT
                  </ThemedText>
                </View>
              )}
              <View style={styles.spacer} />
              <ThemedText type="small">
                {micro.consumed.toLocaleString()}
                <ThemedText type="small" themeColor="textSecondary">
                  {' '}
                  / {micro.target.toLocaleString()} {micro.unit}
                </ThemedText>
              </ThemedText>
            </View>
            <ProgressBar fraction={fraction} color={fill} height={5} />
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
    gap: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  tag: {
    borderRadius: 4,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
  },
  tagText: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
});
