import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing, useTheme } from '@/theme';

/** A single daily coaching insight — eventually generated from the user's data. */
export function InsightCard({ text }: { text: string }) {
  const { colors } = useTheme();

  return (
    <Card>
      <View style={styles.titleRow}>
        <SymbolView
          name={{ ios: 'sparkles', android: 'auto_awesome' }}
          size={15}
          tintColor={colors.primary}
          fallback={<View />}
        />
        <ThemedText type="micro" themeColor="textSecondary">
          Insight
        </ThemedText>
      </View>
      <ThemedText type="sm">{text}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
});
