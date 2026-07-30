import { StyleSheet, View } from 'react-native';

import { AddButton } from '@/components/add-button';
import { AppHeader } from '@/components/app-header';
import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';

/**
 * The main app shell: the persistent header above the native tab bar. Fonts,
 * theme, and the first-run gate live in the root layout ([../_layout.tsx]).
 *
 * `AddButton` is a sibling of the tabs rather than a child, and comes last so
 * it paints over the native tab bar — a native bar cannot render a custom
 * item. See [../../components/add-button.tsx] for how the two stay aligned.
 */
export default function TabsLayout() {
  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <View style={styles.tabs}>
        <AppTabs />
      </View>
      <AddButton />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flex: 1,
  },
});
