import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Liquid glass on iOS 26+, flat themed card everywhere else. */
export function Card({ style, ...rest }: ViewProps) {
  if (isLiquidGlassAvailable()) {
    return <GlassView style={[styles.card, style]} {...rest} />;
  }
  return <ThemedView type="backgroundElement" style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
  },
});
