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
 */

/** Soft fills = base color at a fixed alpha (#RRGGBBAA). */
const soft = (hex: string, alpha: '18' | '1F') => `${hex}${alpha}`;

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
  inkStrong: lightBase.primary,
};

export type ThemeColors = { [K in keyof typeof light]: string };

const darkBase = {
  bg: '#0C1211',
  surface: '#161E1C',
  surfaceSunken: '#101615',
  text: '#ECF2EF',
  textSecondary: '#9DAFA9',
  textTertiary: '#77878F',
  border: '#263230',
  borderStrong: '#374743',
  primary: '#C7F239',
  onPrimary: '#2A3A00',
  secondary: '#2A4A50',
  onSecondary: '#ECF2EF',
  accent: '#C7F239',
  onAccent: '#2A3A00',
  accentText: '#C7F239',
  focusRing: '#C7F239',
  macroProtein: '#B49BFF',
  macroProteinText: '#B49BFF',
  macroProteinSoft: soft('#B49BFF', '1F'),
  macroCarbs: '#FFC24B',
  macroCarbsText: '#FFC24B',
  macroCarbsSoft: soft('#FFC24B', '1F'),
  macroFat: '#3FD0EC',
  macroFatText: '#3FD0EC',
  macroFatSoft: soft('#3FD0EC', '1F'),
  success: '#2FBF71',
  successText: '#4ED98B',
  successSoft: soft('#2FBF71', '1F'),
  danger: '#E5484D',
  dangerText: '#FF7A7E',
  dangerSoft: soft('#E5484D', '1F'),
  ringTrack: '#22302D',
  scrim: 'rgba(0,0,0,0.6)',
} as const;

export const dark: ThemeColors = {
  ...darkBase,
  actionPrimary: darkBase.primary,
  onActionPrimary: darkBase.onPrimary,
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
