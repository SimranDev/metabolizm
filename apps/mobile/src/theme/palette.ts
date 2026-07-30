/**
 * Kinetic color palettes. Light is the default; dark activates via the OS.
 *
 * Role rules — enforced by convention and component APIs:
 * - `accent` (lime) is ONLY for active states, progress indication, streaks,
 *   and the single active bottom-nav item. Never body text, never nav
 *   backgrounds or inactive tabs, and never lime text on a light background
 *   (use `accentText`, which is olive in light).
 * - `macro*` colors are ONLY for macro visualizations (bars/chips/labels) —
 *   never buttons or nav.
 * - `success`/`danger` are ONLY for status/validation — never decorative.
 * - `focusRing` renders as a 2px border on focused/selected interactive
 *   elements.
 * - `actionPrimary`/`onActionPrimary`/`inkStrong` are role aliases spread from
 *   base tokens so they can never drift; `inkStrong` is what headers and key
 *   numbers use (primary in light, plain text in dark).
 *
 * **Dark mode gets its structure from strokes, not from fill lightness.** The
 * two schemes are not mirror images. Light can separate a card from the canvas
 * with a 1.04:1 fill step plus a shadow, because near-white deltas stay
 * perceptible and a dark shadow reads on a bright ground. Neither holds in
 * dark: a shadow over a near-black canvas renders nothing (see `Elevation` in
 * tokens.ts, which is why it is keyed by scheme), and at low screen brightness
 * ambient room light adds a near-constant luminance to every pixel that
 * compresses all the near-blacks toward one flat grey. Measured: `surface` vs
 * `bg` is 1.11:1, and ~1.06:1 once ~5% reflected light is in play.
 *
 * So the dark values below deliberately do NOT try to win by spreading
 * `bg`/`surface`/`surfaceSunken` further apart — that tops out around 1.2:1
 * and still collapses. Anything a user must *locate* rather than merely read
 * carries a visible border or a text-weight color, both of which survive that
 * flattening. `borderStrong` clears 3:1 against every background it sits on
 * (WCAG 1.4.11) and is the token for control boundaries: an unfocused input,
 * a switch's off-track. `ringTrack` is subordinate on purpose — it backs data
 * fills (rings, macro bars) that supply their own contrast, so it sits near
 * 2.2:1 rather than competing with the value it frames.
 */

/**
 * Soft fills = base color at a fixed alpha (#RRGGBBAA). Dark carries roughly
 * double light's alpha: 12% over a near-black canvas composites to ~1.2:1 —
 * the chip loses its container and reads as bare text.
 */
const soft = (hex: string, alpha: '18' | '33') => `${hex}${alpha}`;

const lightBase = {
  bg: '#FAFBF9',
  surface: '#FFFFFF',
  surfaceSunken: '#F1F4F0',
  text: '#14201F',
  textSecondary: '#4A5A57',
  textTertiary: '#5E6D69',
  border: '#E2E8E3',
  borderStrong: '#C5CFC8',
  primary: '#1C5279',
  onPrimary: '#FAFBF9',
  secondary: '#3F6E92',
  onSecondary: '#FFFFFF',
  // A filled action that must NOT read as accent or brand — currently the nav's
  // add button, which sits beside the lime active-tab indicator and would
  // compete with it. Same grey-green family as `text`/`textSecondary`, lifted
  // ~6% in lightness off `text` so it stays the most prominent thing in the bar
  // without going stark. Dark's value is the exception: `text` is already at
  // ~94% lightness there, so it takes what headroom is left rather than a
  // literal +6, which would just be white.
  actionNeutral: '#203331',
  accent: '#C7F239',
  onAccent: '#2A3A00',
  accentText: '#5C7300',
  focusRing: '#1C5279',
  macroProtein: '#6D4AD8',
  macroProteinText: '#6A45D6',
  macroProteinSoft: soft('#6D4AD8', '18'),
  macroCarbs: '#B87E00',
  macroCarbsText: '#8F6200',
  macroCarbsSoft: soft('#B87E00', '18'),
  macroFat: '#0898B5',
  macroFatText: '#0B7E96',
  macroFatSoft: soft('#0898B5', '18'),
  success: '#2FBF71',
  successText: '#1D7A47',
  successSoft: soft('#2FBF71', '18'),
  danger: '#E5484D',
  dangerText: '#B93036',
  dangerSoft: soft('#E5484D', '18'),
  ringTrack: '#E7ECE6',
  scrim: 'rgba(12,18,17,0.5)',
} as const;

export const light = {
  ...lightBase,
  actionPrimary: lightBase.primary,
  onActionPrimary: lightBase.onPrimary,
  // The canvas colour is the readable foreground on `actionNeutral` in both
  // schemes, since that fill is a near-`text` value. Aliased rather than
  // restated so the pair can never drift.
  onActionNeutral: lightBase.bg,
  inkStrong: lightBase.primary,
};

export type ThemeColors = { [K in keyof typeof light]: string };

const darkBase = {
  bg: '#0C1211',
  surface: '#161E1C',
  surfaceSunken: '#101615',
  text: '#ECF2EF',
  textSecondary: '#9DAFA9',
  // 6.6:1 on surface. The old #77878F was 4.57:1 — nominally AA, but AA's 4.5
  // assumes ~16px body text and this token drives 11px uppercase `micro`
  // labels and every placeholder, where it fell under 3:1 at low brightness.
  // Also pulled into the green-grey family; the old value was a blue-grey
  // outlier against `textSecondary`.
  textTertiary: '#93A5A0',
  border: '#263230',
  // 3.0:1 on surfaceSunken, 3.1:1 on bg — WCAG 1.4.11 for control boundaries.
  borderStrong: '#546661',
  primary: '#C7F239',
  onPrimary: '#2A3A00',
  secondary: '#2A4A50',
  onSecondary: '#ECF2EF',
  // See light's note. `text` here is #ECF2EF at ~94% lightness, so this is a
  // ~3.5pp lift — all the headroom there is before the circle is simply white
  // and blooms against the near-black bar.
  actionNeutral: '#F5FAF8',
  accent: '#C7F239',
  onAccent: '#2A3A00',
  accentText: '#C7F239',
  focusRing: '#C7F239',
  macroProtein: '#B49BFF',
  macroProteinText: '#B49BFF',
  macroProteinSoft: soft('#B49BFF', '33'),
  macroCarbs: '#FFC24B',
  macroCarbsText: '#FFC24B',
  macroCarbsSoft: soft('#FFC24B', '33'),
  macroFat: '#3FD0EC',
  macroFatText: '#3FD0EC',
  macroFatSoft: soft('#3FD0EC', '33'),
  success: '#2FBF71',
  successText: '#4ED98B',
  // Soft fills derive from the *brightened* dark variant, not the base — the
  // same way every macro*Soft above does. Washing the base `#2FBF71`/`#E5484D`
  // over a near-black canvas barely lifts it (dangerSoft landed at 1.22:1 even
  // at 20%), because those two bases are tuned for a white ground.
  successSoft: soft('#4ED98B', '33'),
  danger: '#E5484D',
  dangerText: '#FF7A7E',
  dangerSoft: soft('#FF7A7E', '33'),
  // 2.2:1 on surface (was 1.24:1 — the unfilled half of every ring and macro
  // bar was invisible, so a bar at 30% read as a stub with no scale). Stays
  // below borderStrong by design: this is a data track, not a control edge.
  ringTrack: '#4A5751',
  scrim: 'rgba(0,0,0,0.6)',
} as const;

export const dark: ThemeColors = {
  ...darkBase,
  actionPrimary: darkBase.primary,
  onActionPrimary: darkBase.onPrimary,
  onActionNeutral: darkBase.bg,
  inkStrong: darkBase.text,
};

export type MacroKind = 'protein' | 'carbs' | 'fat';

/** Fill color for a macro visualization (bars/segments/dots). */
export function macroColor(colors: ThemeColors, macro: MacroKind): string {
  return macro === 'protein'
    ? colors.macroProtein
    : macro === 'carbs'
      ? colors.macroCarbs
      : colors.macroFat;
}

/** Text-safe variant of a macro color (meets contrast on the scheme's bg). */
export function macroTextColor(colors: ThemeColors, macro: MacroKind): string {
  return macro === 'protein'
    ? colors.macroProteinText
    : macro === 'carbs'
      ? colors.macroCarbsText
      : colors.macroFatText;
}

/** Soft-tinted fill for a macro chip. Pair with `macroTextColor` on top. */
export function macroSoftColor(colors: ThemeColors, macro: MacroKind): string {
  return macro === 'protein'
    ? colors.macroProteinSoft
    : macro === 'carbs'
      ? colors.macroCarbsSoft
      : colors.macroFatSoft;
}
