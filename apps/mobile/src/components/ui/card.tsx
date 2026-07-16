import { StyleSheet, View, type ViewProps } from 'react-native';

import { Elevation, Radius, Spacing, useTheme } from '@/theme';

/** Flat Kinetic card: surface, hairline border, subtle shadow. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        Elevation.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.s16,
    gap: Spacing.s8,
    // No overflow:'hidden' — it would clip the iOS card shadow. Children that
    // need rounded clipping (bars, sparklines) clip themselves.
  },
});
