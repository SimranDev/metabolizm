import { ScrollView, StyleSheet } from 'react-native';

import { AppearanceCard } from '@/components/profile/appearance-card';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/theme';

export default function AppearanceScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Appearance" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppearanceCard />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.s16, paddingBottom: Spacing.s48, gap: Spacing.s16 },
});
