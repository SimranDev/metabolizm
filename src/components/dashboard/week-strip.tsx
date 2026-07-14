import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing, useTheme } from '@/theme';

const CHART_HEIGHT = 72;
const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  /** Calories eaten per day, oldest → today (length 7). */
  calories: readonly number[];
  target: number;
};

/**
 * Last 7 days of intake as columns against a target hairline — days over
 * target turn red. Today is the last column with an emphasized label.
 */
export function WeekStrip({ calories, target }: Props) {
  const { colors } = useTheme();
  const scale = Math.max(...calories, target) * 1.08;
  const today = new Date();

  const days = calories.map((cal, i) => ({
    cal,
    letter: new Date(today.getTime() - (calories.length - 1 - i) * DAY_MS).toLocaleDateString(
      undefined,
      { weekday: 'narrow' },
    ),
  }));
  const overCount = calories.filter((c) => c > target).length;

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="micro" themeColor="textSecondary">
          Last 7 days
        </ThemedText>
        <ThemedText type="sm" themeColor="textSecondary" tabular>
          target {target.toLocaleString()} cal
        </ThemedText>
      </View>

      <View
        accessible
        accessibilityLabel={`Calories over the last 7 days against a ${target} calorie target: ${overCount} ${overCount === 1 ? 'day' : 'days'} over, today ${calories[calories.length - 1]} calories`}>
        <View style={styles.chart}>
          <View
            style={[
              styles.targetLine,
              {
                bottom: (target / scale) * CHART_HEIGHT,
                backgroundColor: colors.textSecondary,
              },
            ]}
          />
          {days.map((day, i) => (
            <View key={i} style={styles.column}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max((day.cal / scale) * CHART_HEIGHT, 3),
                    backgroundColor: day.cal > target ? colors.danger : colors.primary,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.labels}>
          {days.map((day, i) => {
            const isToday = i === days.length - 1;
            return (
              <ThemedText
                key={i}
                type={isToday ? 'smBold' : 'sm'}
                themeColor={isToday ? 'text' : 'textSecondary'}
                style={styles.dayLabel}>
                {day.letter}
              </ThemedText>
            );
          })}
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
  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '55%',
    maxWidth: 28,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  labels: {
    flexDirection: 'row',
    marginTop: Spacing.s4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
  },
});
