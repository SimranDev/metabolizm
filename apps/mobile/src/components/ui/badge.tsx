import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type, useTheme, type ThemeColors } from '@/theme';

type Variant = 'neutral' | 'accent' | 'outline';
type Size = 'sm' | 'md';

type Props = {
  label: string;
  /** Leading glyph, given the badge's content color. */
  icon?: (color: string) => ReactNode;
  /** Trailing glyph (e.g. a chevron), given the content color. */
  trailing?: (color: string) => ReactNode;
  /** accent (lime) is reserved for streaks/active states — an allowed accent role. */
  variant?: Variant;
  size?: Size;
};

/**
 * Pill chip/badge — the only place `Radius.pill` is allowed. Non-interactive;
 * wrap in a Pressable if it needs to be tappable.
 */
export function Badge({ label, icon, trailing, variant = 'neutral', size = 'md' }: Props) {
  const { colors } = useTheme();
  const { backgroundColor, contentColor, borderColor } = variantColors(variant, colors);

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor, borderColor: borderColor ?? 'transparent' },
      ]}>
      {icon?.(contentColor)}
      <Text style={[size === 'sm' ? Type.micro : Type.smBold, { color: contentColor }]}>
        {label}
      </Text>
      {trailing?.(contentColor)}
    </View>
  );
}

function variantColors(variant: Variant, colors: ThemeColors) {
  switch (variant) {
    case 'neutral':
      return {
        backgroundColor: colors.surfaceSunken,
        contentColor: colors.textSecondary,
        borderColor: undefined,
      };
    case 'accent':
      return {
        backgroundColor: colors.accent,
        contentColor: colors.onAccent,
        borderColor: undefined,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        contentColor: colors.textSecondary,
        borderColor: colors.borderStrong,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.s4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  md: {
    paddingHorizontal: Spacing.s12,
    paddingVertical: Spacing.s4,
  },
  sm: {
    paddingHorizontal: Spacing.s8,
    paddingVertical: 2,
  },
});
