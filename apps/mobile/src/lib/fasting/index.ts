/**
 * Display helpers for the fasting timer.
 *
 * Everything is derived from `startedAt` and the current clock, so nothing here
 * caches a duration — a stored elapsed would be wrong the moment the app was
 * backgrounded, which is most of a fast.
 */

import {
  FASTING_PROTOCOLS,
  elapsedHours,
  fastingProtocol,
  type FastingSessionDto,
} from "@metabolizm/shared";

export { FASTING_PROTOCOLS, elapsedHours, fastingProtocol };

/**
 * How often a mounted view recomputes elapsed time.
 *
 * The detail screen ticks every second because it shows seconds. A tile shows
 * hours and minutes, so it ticks a minute — sixty times less work for a value
 * that would otherwise change on 59 of every 60 renders without moving a pixel.
 */
export const TICK_MS_DETAIL = 1000;
export const TICK_MS_TILE = 60_000;

/** "14h 32m", or "0h 04m" early on. Hours are never dropped — a bare "4m" reads as four minutes into nothing. */
export function formatElapsed(hours: number): string {
  const totalMinutes = Math.floor(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** "14:32:07" — for the detail screen's live readout. */
export function formatElapsedPrecise(hours: number): string {
  const totalSeconds = Math.floor(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Progress toward the target, clamped to 0–1 for a ring. */
export function fastFraction(hours: number, targetHours: number): number {
  if (targetHours <= 0) return 0;
  return Math.min(1, Math.max(0, hours / targetHours));
}

/**
 * How much of the window is left, or null once it has been reached.
 *
 * Null rather than a negative or a zero: past the target the fast is *done*,
 * and "0h 00m to go" invites the reading that something ran out.
 */
export function remainingHours(
  hours: number,
  targetHours: number,
): number | null {
  const left = targetHours - hours;
  return left > 0 ? left : null;
}

/** A finished fast's duration in hours. */
export function sessionHours(session: FastingSessionDto): number {
  const end = session.endedAt ? new Date(session.endedAt) : new Date();
  return Math.max(
    0,
    (end.getTime() - new Date(session.startedAt).getTime()) / 3_600_000,
  );
}

/** "16:8" for a preset, "Custom" otherwise. */
export function protocolLabel(session: FastingSessionDto): string {
  return fastingProtocol(session.protocol)?.label ?? "Custom";
}

/** "Tue 7:30 pm" — when a fast began or ended. */
export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
