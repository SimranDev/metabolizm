import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A single daily coaching insight — eventually generated from the user's data. */
export function InsightCard({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.titleRow}>
        <SymbolView
          name={{ ios: 'sparkles', android: 'auto_awesome' }}
          size={15}
          tintColor={theme.tint}
          fallback={<View />}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
          INSIGHT
        </ThemedText>
      </View>
      <ThemedText type="small">{text}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  caps: {
    letterSpacing: 1.2,
  },
});
