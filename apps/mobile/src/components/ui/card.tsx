import { StyleSheet, View, type ViewProps } from 'react-native';

import { Elevation, Radius, Spacing, useTheme } from '@/theme';

/** Flat Kinetic card: surface, hairline border, subtle shadow. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors, scheme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        // Scheme-keyed: dark contributes no shadow, because a shadow over a
        // near-black canvas draws nothing. Its edge comes from the border.
        Elevation[scheme].card,
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
