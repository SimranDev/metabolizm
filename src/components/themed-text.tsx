import { StyleSheet, Text, type TextProps } from 'react-native';

import {
  TabularFamily,
  Type,
  useTheme,
  type ThemeColors,
  type TypeVariant,
} from '@/theme';

export type ThemedTextProps = TextProps & {
  type?: TypeVariant;
  themeColor?: keyof ThemeColors;
  /**
   * Render inline numerals in Space Grotesk with tabular figures. Use on any
   * text that is (or contains) a number so ALL numerals share the display
   * family and column-align.
   */
  tabular?: boolean;
};

/** Headers and key numbers read in `inkStrong` (primary in light, text in dark). */
const INK_STRONG_TYPES: ReadonlySet<TypeVariant> = new Set([
  'h1',
  'h2',
  'stat',
  'statSm',
  'statXl',
]);

export function ThemedText({
  style,
  type = 'body',
  themeColor,
  tabular = false,
  ...rest
}: ThemedTextProps) {
  const { colors } = useTheme();

  const color =
    colors[
      themeColor ?? (type === 'link' ? 'primary' : INK_STRONG_TYPES.has(type) ? 'inkStrong' : 'text')
    ];

  return (
    <Text
      style={[
        { color },
        Type[type],
        tabular && [
          styles.tabular,
          { fontFamily: TabularFamily[Type[type].fontFamily] ?? Type[type].fontFamily },
        ],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
