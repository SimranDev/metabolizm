/**
 * Display helpers for hydration.
 *
 * Storage is always millilitres (see lib/api/water); everything here is render
 * time only. Litres are the AU/NZ unit and the only one offered — a fl oz
 * preference is a deliberate deferral, not an oversight, and the storage rule
 * already makes it a render-layer change if a US market ever needs it.
 */

import { ML_PER_L } from "@metabolizm/shared";

/**
 * Quick-add sizes, in millilitres. A glass, a large glass, and a standard
 * bottle — the three amounts people actually drink in one go. Anything else
 * goes through the custom field, which is why this list stays short: a grid of
 * eight is slower to use than a grid of three plus a keypad.
 */
export const QUICK_ADD_ML = [250, 500, 750] as const;

/**
 * "1.2 L" above a litre, "750 ml" below it.
 *
 * Millilitres are how a bottle is labelled and litres are how a day is talked
 * about, so the unit follows the magnitude rather than being fixed. Litres get
 * one decimal — "1.25 L" is more precision than anyone tracks water to.
 */
export function formatVolume(ml: number): string {
  if (ml >= ML_PER_L) return `${(ml / ML_PER_L).toFixed(1)} L`;
  return `${Math.round(ml)} ml`;
}

/** The value alone, for pairing with a separate unit label. */
export function volumeValue(ml: number): string {
  return ml >= ML_PER_L ? (ml / ML_PER_L).toFixed(1) : String(Math.round(ml));
}

export function volumeUnit(ml: number): string {
  return ml >= ML_PER_L ? "L" : "ml";
}

/** Progress toward the goal, clamped to 0–1 for a ring. */
export function goalFraction(totalMl: number, goalMl: number): number {
  if (goalMl <= 0) return 0;
  return Math.min(1, Math.max(0, totalMl / goalMl));
}

/** Time of day a drink was logged, e.g. "2:45 pm". */
export function formatLoggedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
