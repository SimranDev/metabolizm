import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, useTheme } from '@/theme';

type Item = {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
};

/**
 * A compact strip of computed feedback (BMI, TDEE, projected date) that updates
 * live as the user changes inputs. Pure text — the "interactive" delight comes
 * from the numbers reacting, not from animation.
 */
export function LiveReadout({ items }: { items: Item[] }) {
  const { colors } = useTheme();

  return (
    <ThemedView type="surfaceSunken" style={styles.card}>
      {items.map((item, i) => (
        <View key={item.label} style={styles.row}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          <View style={styles.cell}>
            <ThemedText type="micro" themeColor="textSecondary" style={styles.label}>
              {item.label}
            </ThemedText>
            <ThemedText
              type="smBold"
              tabular
              themeColor={item.tone === 'warn' ? 'dangerText' : 'text'}
              style={styles.value}>
              {item.value}
            </ThemedText>
          </View>
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.s16,
  },
  row: { flex: 1, flexDirection: 'row' },
  divider: { width: StyleSheet.hairlineWidth },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.s8,
  },
  label: { textAlign: 'center' },
  value: { fontSize: 15, textAlign: 'center' },
});
