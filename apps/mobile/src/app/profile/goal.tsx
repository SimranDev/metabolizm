import { ScrollView, StyleSheet } from 'react-native';

import { GoalWeightCard } from '@/components/profile/goal-weight-card';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useProfile } from '@/store/profile';
import { useWeight } from '@/store/weight';
import { Spacing } from '@/theme';

export default function GoalWeightScreen() {
  const profile = useProfile((s) => s.profile);
  const unit = useWeight((s) => s.unit);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Goal weight" />
      {profile ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GoalWeightCard profile={profile} unit={unit} />
        </ScrollView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.s16, paddingBottom: Spacing.s48, gap: Spacing.s16 },
});
