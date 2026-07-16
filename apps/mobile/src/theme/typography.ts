import { Platform, type TextStyle } from 'react-native';

/**
 * Kinetic font families. Space Grotesk carries display type and ALL numerals
 * (always with `fontVariant: ['tabular-nums']`); Instrument Sans carries UI
 * and body copy. Each weight is a separate family (registered via `useFonts`
 * in the root layout) because React Native does not synthesize weights from a
 * single font file — reference these by name, do not rely on `fontWeight`.
 */
export const Fonts = {
  display: 'SpaceGrotesk_400Regular',
  displayMedium: 'SpaceGrotesk_500Medium',
  displaySemiBold: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  sans: 'InstrumentSans_400Regular',
  sansItalic: 'InstrumentSans_400Regular_Italic',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  mono: Platform.select({
    ios: 'ui-monospace',
    web: 'var(--font-mono)',
    default: 'monospace',
  }),
} as const;

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Kinetic type scale. Line heights: tight 1.05 (stats), heading 1.2,
 * body 1.5. Stats track at −0.02em; micro labels are uppercase at +0.08em.
 */
export const Type = {
  statXl: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 64,
    lineHeight: 67,
    letterSpacing: -1.28,
    fontVariant: TABULAR,
  },
  stat: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.8,
    fontVariant: TABULAR,
  },
  statSm: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 28,
    lineHeight: 29,
    letterSpacing: -0.56,
    fontVariant: TABULAR,
  },
  h1: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  h2: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
  },
  h3: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 17,
    lineHeight: 20,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  sm: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  smBold: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 20,
  },
  micro: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
  link: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    lineHeight: 20,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

/** Display-family swap for inline numerals (ThemedText `tabular` prop). */
export const TabularFamily: Record<string, string> = {
  [Fonts.sans]: Fonts.display,
  [Fonts.sansMedium]: Fonts.displayMedium,
  [Fonts.sansSemiBold]: Fonts.displaySemiBold,
  [Fonts.sansBold]: Fonts.displayBold,
};
