import { StyleSheet, Text, View } from 'react-native';

import { Type, useTheme, type ThemeColors } from '@/theme';

type Size = 'xl' | 'md' | 'sm';

type Props = {
  /** Pre-formatted value ("1,850", "72", "16:8"). Numbers get toLocaleString. */
  value: string | number;
  /** Small secondary trailer ("/100", " cal", " kg"). */
  suffix?: string;
  /** statXl 64 / stat 40 / statSm 28. */
  size?: Size;
  /** Defaults to `inkStrong` (primary in light, text in dark). */
  color?: keyof ThemeColors;
};

const SIZE_STYLE: Record<Size, (typeof Type)['statXl' | 'stat' | 'statSm']> = {
  xl: Type.statXl,
  md: Type.stat,
  sm: Type.statSm,
};

/** A key number: Space Grotesk, tabular figures, tight tracking. */
export function StatNumber({ value, suffix, size = 'md', color = 'inkStrong' }: Props) {
  const { colors } = useTheme();
  const text = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <View style={styles.row}>
      <Text style={[SIZE_STYLE[size], { color: colors[color] }]}>{text}</Text>
      {suffix ? (
        <Text style={[size === 'sm' ? Type.sm : Type.body, { color: colors.textSecondary }]}>
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
