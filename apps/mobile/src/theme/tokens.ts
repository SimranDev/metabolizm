import { Platform, type ViewStyle } from 'react-native';

/** Kinetic spacing — 4px grid. Generous whitespace is a brand trait. */
export const Spacing = {
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s20: 20,
  s24: 24,
  s32: 32,
  s40: 40,
  s48: 48,
  s64: 64,
} as const;

/** Kinetic radii. `pill` is ONLY for chips/badges. */
export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/** Motion durations (ms). Pair with `Easing.out(Easing.cubic)` — no bounce. */
export const Motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Flat elevation — subtle shadows, no gradients. */
export const Elevation: Record<'card' | 'raised', ViewStyle> = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14201F',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 1 },
  }),
  raised: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14201F',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 4 },
  }),
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
