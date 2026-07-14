import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'plain' | 'sunken' | 'primary';

type Props = {
  /** Icon render prop, given the variant's content color. */
  icon: (color: string) => ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** plain = bare glyph; sunken = circle on surfaceSunken; primary = filled action. */
  variant?: Variant;
  /** Visual diameter; the hit target is always at least 44px via hitSlop. */
  size?: number;
  disabled?: boolean;
};

const MIN_HIT_TARGET = 44;

/** Circular icon button. Pressed = scale 0.98. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'sunken',
  size = 34,
  disabled = false,
}: Props) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === 'primary'
      ? colors.actionPrimary
      : variant === 'sunken'
        ? colors.surfaceSunken
        : 'transparent';
  const contentColor =
    variant === 'primary' ? colors.onActionPrimary : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={Math.max(0, (MIN_HIT_TARGET - size) / 2)}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {icon(contentColor)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
