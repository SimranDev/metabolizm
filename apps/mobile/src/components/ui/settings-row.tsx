/**
 * Grouped settings rows — a titled section wrapping a card of tappable rows,
 * each showing its current value so the group reads as a summary rather than a
 * list of doors.
 *
 * Same construction as `meal-section`: a `Card` with its padding removed and
 * hairline dividers between children, because `Card` cannot use
 * `overflow: 'hidden'` without clipping its iOS shadow.
 */

import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing, useTheme } from '@/theme';

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText type="micro" themeColor="textSecondary">
        {title}
      </ThemedText>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  onPress,
  first,
}: {
  label: string;
  /** Current setting, shown right-aligned. A row with no value is just a door. */
  value?: string;
  /** Omit to render a read-only row (no chevron, no press feedback). */
  onPress?: () => void;
  first?: boolean;
}) {
  const { colors } = useTheme();

  const body = (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {value ? (
        <ThemedText type="sm" themeColor="textSecondary" numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {onPress ? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
          size={16}
          tintColor={colors.textTertiary}
          fallback={<View style={styles.iconSpacer} />}
        />
      ) : null}
    </View>
  );

  return (
    <>
      {first ? null : <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => pressed && styles.pressed}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.s8 },
  card: { padding: 0, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
    paddingVertical: Spacing.s16,
    paddingHorizontal: Spacing.s16,
  },
  label: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.s16 },
  iconSpacer: { width: 16 },
  pressed: { opacity: 0.6 },
});
