import { ScrollView, StyleSheet } from 'react-native';

import { TargetsCard } from '@/components/profile/targets-card';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useProfile } from '@/store/profile';
import { Spacing } from '@/theme';

export default function TargetsScreen() {
  const profile = useProfile((s) => s.profile);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Daily targets" />
      {profile ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TargetsCard profile={profile} />
        </ScrollView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.s16, paddingBottom: Spacing.s48, gap: Spacing.s16 },
});
