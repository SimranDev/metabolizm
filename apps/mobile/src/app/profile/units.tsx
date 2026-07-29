import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { useProfile } from '@/store/profile';
import { useWeight } from '@/store/weight';
import { Spacing } from '@/theme';
import type { HeightUnit, WeightUnit } from '@metabolizm/shared';

const WEIGHT_OPTIONS: readonly { value: WeightUnit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
  { value: 'st', label: 'st' },
];

const HEIGHT_OPTIONS: readonly { value: HeightUnit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'ftin', label: 'ft/in' },
];

/**
 * Display units.
 *
 * A display preference only — every weight crossing the API is in kilograms and
 * every height in centimetres, converted once at render via `lib/weight` and
 * `lib/health`. Changing anything here rewrites no stored data.
 *
 * The inline toggle inside `WeightField` stays: it is a convenience while
 * entering a number. This screen is where the default lives.
 */
export default function UnitsScreen() {
  const profile = useProfile((s) => s.profile);
  const updateProfile = useProfile((s) => s.updateProfile);
  const unit = useWeight((s) => s.unit);
  const setUnit = useWeight((s) => s.setUnit);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Units" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <ThemedText type="micro" themeColor="textSecondary">
            WEIGHT
          </ThemedText>
          <Segmented options={WEIGHT_OPTIONS} value={unit} onChange={setUnit} />
        </Card>

        <Card style={styles.card}>
          <ThemedText type="micro" themeColor="textSecondary">
            HEIGHT
          </ThemedText>
          <Segmented
            options={HEIGHT_OPTIONS}
            value={profile?.heightUnit ?? 'cm'}
            onChange={(heightUnit) => updateProfile({ heightUnit })}
          />
        </Card>

        <ThemedText type="sm" themeColor="textTertiary">
          Display only. Your weights and heights are stored in kilograms and centimetres, so
          switching units never changes a saved number.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.s16, paddingBottom: Spacing.s48, gap: Spacing.s16 },
  card: { gap: Spacing.s12 },
});
