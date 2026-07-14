import { type ReactNode, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing, useTheme } from '@/theme';

type Props = TextInputProps & {
  /** Micro-caps label rendered above the field. */
  label?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Numeric entry: Space Grotesk with tabular figures. */
  numeric?: boolean;
};

/**
 * The app's text field. Sunken box, 2px focus ring (border is always 2px —
 * transparent when blurred — so focusing never shifts layout).
 */
export function Input({
  label,
  leading,
  trailing,
  numeric = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <ThemedText type="micro" themeColor="textTertiary">
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surfaceSunken,
            borderColor: focused ? colors.focusRing : 'transparent',
          },
        ]}>
        {leading}
        <TextInput
          placeholderTextColor={colors.textTertiary}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: colors.text },
            numeric && styles.numeric,
            style,
          ]}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.s8,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s8,
    height: 48,
    paddingHorizontal: Spacing.s16,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    // Trim RN's default vertical padding so text sits centered in the box.
    paddingVertical: 0,
  },
  numeric: {
    fontFamily: Fonts.display,
    fontVariant: ['tabular-nums'],
  },
});
