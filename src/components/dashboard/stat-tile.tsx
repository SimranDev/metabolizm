import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/dashboard/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: SymbolViewProps['name'];
  label: string;
  value: string;
  sub?: string;
  /** Icon (and progress fill) color. Defaults to the app tint. */
  tint?: ThemeColor;
  /** Optional mini progress toward a goal, 0–1. */
  progress?: number;
};

/** Small dashboard stat: icon + label header, big value, optional sub/progress. */
export function StatTile({ icon, label, value, sub, tint = 'tint', progress }: Props) {
  const theme = useTheme();

  return (
    <Card style={styles.tile}>
      <View style={styles.header}>
        <SymbolView name={icon} size={16} tintColor={theme[tint]} fallback={<View />} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={styles.value}>{value}</ThemedText>
      {sub !== undefined && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      )}
      {progress !== undefined && <ProgressBar fraction={progress} color={theme[tint]} height={6} />}
    </Card>
  );
}

/** Two-column wrapping grid for StatTiles. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  value: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 24,
    lineHeight: 30,
  },
});
