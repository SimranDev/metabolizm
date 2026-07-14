import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing, useTheme, type ThemeColors } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  /** primary = filled action; secondary = outline; ghost = bare; danger = destructive. */
  variant?: Variant;
  /** Heights: sm 34 / md 44 / lg 52. */
  size?: Size;
  /** Leading icon, given the label color so content always matches the variant. */
  icon?: (color: string) => ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
};

const HEIGHT: Record<Size, number> = { sm: 34, md: 44, lg: 52 };
const FONT_SIZE: Record<Size, number> = { sm: 13, md: 15, lg: 17 };
const PAD_H: Record<Size, number> = { sm: Spacing.s12, md: Spacing.s16, lg: Spacing.s20 };

/** The app's button. Pressed = scale 0.98; disabled = opacity 0.45. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  disabled = false,
}: Props) {
  const { colors } = useTheme();

  const { backgroundColor, labelColor, borderColor } = variantColors(variant, colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD_H[size],
          backgroundColor,
          borderColor: borderColor ?? 'transparent',
        },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {icon ? <View style={styles.icon}>{icon(labelColor)}</View> : null}
      <Text style={[styles.label, { color: labelColor, fontSize: FONT_SIZE[size] }]}>{label}</Text>
    </Pressable>
  );
}

function variantColors(variant: Variant, colors: ThemeColors) {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: colors.actionPrimary,
        labelColor: colors.onActionPrimary,
        borderColor: undefined,
      };
    case 'secondary':
      return {
        backgroundColor: 'transparent',
        labelColor: colors.inkStrong,
        borderColor: colors.borderStrong,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        labelColor: colors.textSecondary,
        borderColor: undefined,
      };
    case 'danger':
      // `onSecondary` is white/off-white in both schemes — the readable
      // foreground on the fixed danger red (dark's `onActionPrimary` is not).
      return {
        backgroundColor: colors.danger,
        labelColor: colors.onSecondary,
        borderColor: undefined,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.s8,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
  },
  icon: {
    marginLeft: -2,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
