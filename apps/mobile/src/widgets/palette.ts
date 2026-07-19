/**
 * Widget color constants, derived from the Kinetic palette
 * (src/theme/palette.ts). Duplicated as plain values because widgets render
 * outside the app runtime (WidgetKit / RemoteViews) where the ThemeProvider
 * does not exist — keep in sync with the app palette when it changes.
 *
 * This file is bundled into the iOS widget extension — keep it free of any
 * react/react-native/app imports.
 */

export type WidgetPalette = {
  surface: string;
  ink: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  track: string;
  border: string;
  success: string;
  macroCarbs: string;
  macroCarbsSoft: string;
  macroCarbsText: string;
  macroFat: string;
  macroFatSoft: string;
  macroFatText: string;
  macroProtein: string;
  macroProteinSoft: string;
  macroProteinText: string;
  /** Decorative-only (sun/moon placeholder illustration on the day arc). */
  sun: string;
  moon: string;
};

export const widgetLight: WidgetPalette = {
  surface: '#FFFFFF',
  ink: '#1C5279',
  text: '#14201F',
  textSecondary: '#4A5A57',
  textTertiary: '#5E6D69',
  track: '#E7ECE6',
  border: '#C5CFC8',
  success: '#1D7A47',
  macroCarbs: '#B87E00',
  macroCarbsSoft: '#B87E0018',
  macroCarbsText: '#8F6200',
  macroFat: '#0898B5',
  macroFatSoft: '#0898B518',
  macroFatText: '#0B7E96',
  macroProtein: '#6D4AD8',
  macroProteinSoft: '#6D4AD818',
  macroProteinText: '#6A45D6',
  sun: '#E8A33D',
  moon: '#8A97A6',
};

export const widgetDark: WidgetPalette = {
  surface: '#161E1C',
  ink: '#ECF2EF',
  text: '#ECF2EF',
  textSecondary: '#9DAFA9',
  textTertiary: '#77878F',
  track: '#22302D',
  border: '#374743',
  success: '#4ED98B',
  macroCarbs: '#FFC24B',
  macroCarbsSoft: '#FFC24B1F',
  macroCarbsText: '#FFC24B',
  macroFat: '#3FD0EC',
  macroFatSoft: '#3FD0EC1F',
  macroFatText: '#3FD0EC',
  macroProtein: '#B49BFF',
  macroProteinSoft: '#B49BFF1F',
  macroProteinText: '#B49BFF',
  sun: '#E8A33D',
  moon: '#8A97A6',
};

export function paletteFor(scheme: 'light' | 'dark' | undefined): WidgetPalette {
  return scheme === 'dark' ? widgetDark : widgetLight;
}
