import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { StatNumber } from '@/components/ui/stat-number';
import { Spacing, useTheme, type ThemeColors } from '@/theme';

import type { Href } from 'expo-router';

type Props = {
  icon: SymbolViewProps['name'];
  label: string;
  /** Where tapping goes. Every tool tile is a door; none is read-only. */
  href: Href;
  /** Icon and ring color. */
  tint?: keyof ThemeColors;
  /**
   * The tool's current figure. Pass null when there is nothing to show yet —
   * the tile renders `empty` instead, never a zero.
   */
  value?: string | null;
  /** Small unit or context trailing the value ("L", "left"). */
  suffix?: string;
  sub?: string;
  /** Optional ring, 0–1. Omit for a tool with no target to run against. */
  fraction?: number;
  /** Shown when `value` is null. Two lines: what's missing, and the invitation. */
  empty?: { title: string; hint: string };
  /** Extra content under the value, e.g. a streak pill. */
  children?: ReactNode;
};

/**
 * A tool on the Toolbox grid (and, for the trackers, on Vitals too).
 *
 * Shaped like [vitals/weight-tile.tsx] deliberately: same 46% basis so it sits
 * in `TileGrid`'s two-column rhythm, same press feedback, and the same rule
 * about absence — a tool with no data yet gets a designed empty state, never a
 * fabricated zero. "0 ml" and "we haven't loaded your day" are different
 * sentences, and only one of them is about the user.
 */
export function ToolTile({
  icon,
  label,
  href,
  tint = 'primary',
  value,
  suffix,
  sub,
  fraction,
  empty,
  children,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const hasValue = value !== null && value !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasValue
          ? `${label}, ${value}${suffix ? ` ${suffix}` : ''}${sub ? `. ${sub}` : ''}. Opens ${label}.`
          : `${label}, ${empty?.title ?? 'nothing logged yet'}. Opens ${label}.`
      }
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <SymbolView name={icon} size={16} tintColor={colors[tint]} fallback={<View />} />
          <ThemedText type="micro" themeColor="textSecondary" style={styles.label}>
            {label}
          </ThemedText>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right' }}
            size={12}
            tintColor={colors.textTertiary}
            fallback={<View />}
          />
        </View>

        {hasValue ? (
          <View style={styles.body}>
            {fraction !== undefined ? (
              <ProgressRing fraction={fraction} size={44} strokeWidth={4} color={colors[tint]} />
            ) : null}
            <View style={styles.values}>
              <View style={styles.valueRow}>
                <StatNumber value={value} size="sm" />
                {suffix ? (
                  <ThemedText type="sm" themeColor="textSecondary">
                    {suffix}
                  </ThemedText>
                ) : null}
              </View>
              {sub ? (
                <ThemedText type="sm" themeColor="textSecondary" tabular numberOfLines={1}>
                  {sub}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            <ThemedText type="body" themeColor="textSecondary">
              {empty?.title ?? 'Not logged yet'}
            </ThemedText>
            <ThemedText type="sm" themeColor="textTertiary">
              {empty?.hint ?? 'Tap to start'}
            </ThemedText>
          </View>
        )}

        {children}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  card: {
    gap: Spacing.s4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
  label: {
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
  },
  values: {
    flex: 1,
    gap: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.s4,
  },
  empty: {
    gap: 2,
    paddingVertical: Spacing.s12,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
