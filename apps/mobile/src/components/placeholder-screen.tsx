import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/theme';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="h1" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Coming soon</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.s8,
    paddingHorizontal: Spacing.s24,
    paddingBottom: BottomTabInset + Spacing.s16,
  },
  title: {
    textAlign: 'center',
  },
});
