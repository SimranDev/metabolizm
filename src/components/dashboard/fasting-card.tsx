import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/dashboard/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  hoursFasted: number;
  goalHours: number;
  lastMeal: string;
};

const formatHours = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
};

/** Time since the last logged meal against a 16:8-style fasting window. */
export function FastingCard({ hoursFasted, goalHours, lastMeal }: Props) {
  const theme = useTheme();
  const remaining = Math.max(goalHours - hoursFasted, 0);

  return (
    <Card
      accessible
      accessibilityLabel={`Fasting ${formatHours(hoursFasted)} of a ${goalHours} hour window, ${remaining > 0 ? `${formatHours(remaining)} to go` : 'window complete'}`}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <SymbolView
            name={{ ios: 'timer', android: 'timer' }}
            size={15}
            tintColor={theme.tint}
            fallback={<View />}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
            FASTING
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          16:8 window
        </ThemedText>
      </View>

      <ThemedText style={styles.value}>
        {formatHours(hoursFasted)}
        <ThemedText type="small" themeColor="textSecondary">
          {'  '}of {goalHours} h
        </ThemedText>
      </ThemedText>

      <ProgressBar fraction={hoursFasted / goalHours} color={theme.tint} />

      <ThemedText type="small" themeColor="textSecondary">
        {remaining > 0 ? `${formatHours(remaining)} to go` : 'Window complete'} · last meal{' '}
        {lastMeal}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  caps: {
    letterSpacing: 1.2,
  },
  value: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 24,
    lineHeight: 30,
  },
});
