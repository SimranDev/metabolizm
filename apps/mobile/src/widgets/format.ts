/**
 * Pure math/format helpers shared by the iOS and Android widget renderers.
 *
 * This file is bundled into the iOS widget extension, whose JS context has no
 * Intl and no react-native — keep everything dependency-free and deterministic.
 */

import type { WidgetDayData } from './types';

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** "1487" → "1,487" without relying on Intl (unavailable in the widget JS context). */
export function formatKcal(n: number): string {
  const whole = String(Math.max(0, Math.round(n)));
  let out = '';
  for (let i = 0; i < whole.length; i++) {
    const fromEnd = whole.length - i;
    out += whole[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += ',';
  }
  return out;
}

/** Grams with at most one decimal: 10 → "10g", 17.5 → "17.5g". */
export function formatGrams(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded % 1 === 0 ? String(Math.round(rounded)) : String(rounded)}g`;
}

/** The eating day the pace visuals run over (sun rises → sets). */
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;

/** 0..1 progress of `date` through the eating day. */
export function dayFraction(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return clamp01((hours - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR));
}

/** Night = moon on the arc instead of the sun. */
export function isNight(date: Date): boolean {
  const h = date.getHours();
  return h >= 20 || h < DAY_START_HOUR;
}

/**
 * Point on the upper semicircle for a 0..1 fraction (0 = left, 1 = right),
 * as an offset from the arc's center. y is negative upward, matching both the
 * SwiftUI `offset` modifier and SVG coordinates.
 */
export function arcPoint(fraction: number, radius: number): { x: number; y: number } {
  const angle = Math.PI * (1 - clamp01(fraction));
  return { x: Math.cos(angle) * radius, y: -Math.sin(angle) * radius };
}

/** Consumed fraction of the calorie target, per macro (4/4/9 kcal per gram). */
export function macroKcalFractions(data: WidgetDayData): {
  carbs: number;
  fat: number;
  protein: number;
} {
  const target = Math.max(1, data.targetCalories);
  return {
    carbs: clamp01((data.carbs.consumedG * 4) / target),
    fat: clamp01((data.fat.consumedG * 9) / target),
    protein: clamp01((data.protein.consumedG * 4) / target),
  };
}

export type PaceTone = 'ok' | 'ahead' | 'behind';

/**
 * How consumption compares to a steady pace through the eating day —
 * the one-line voice under the calorie bar ("on track for dinner").
 */
export function paceStatus(data: WidgetDayData, date: Date): { label: string; tone: PaceTone } {
  if (data.consumedCalories <= 0) return { label: 'log your first meal', tone: 'behind' };
  const expected = dayFraction(date) * data.targetCalories;
  const nextMeal = date.getHours() < 11 ? 'lunch' : date.getHours() < 17 ? 'dinner' : 'today';
  if (data.consumedCalories > Math.max(expected * 1.15, 200)) {
    return { label: 'a bit ahead of pace', tone: 'ahead' };
  }
  return { label: `on track for ${nextMeal}`, tone: 'ok' };
}

/** Name of the macro closest to its own target — the MacroBars footer voice. */
export function leadingMacroLabel(data: WidgetDayData): string {
  if (data.consumedCalories <= 0) return 'log your first meal';
  const frac = (m: { consumedG: number; targetG: number }) =>
    m.targetG > 0 ? m.consumedG / m.targetG : 0;
  const entries: [string, number][] = [
    ['carbs', frac(data.carbs)],
    ['fat', frac(data.fat)],
    ['protein', frac(data.protein)],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return `${entries[0][0]} leading today`;
}

/** SVG path for a circular arc (angles in degrees, 0° = 12 o'clock, clockwise). */
export function svgArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const toPoint = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toPoint(startDeg);
  const end = toPoint(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
