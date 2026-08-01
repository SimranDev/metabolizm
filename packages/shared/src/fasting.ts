/**
 * Wire shapes for the fasting timer.
 *
 * A fast is an interval, so the only thing stored is when it started and when
 * it ended. Elapsed is always derived at read time — a stored running total
 * would need a writer on every tick, and would be wrong the moment the app was
 * closed.
 */

export type FastingSessionDto = {
  id: string;
  /** ISO-8601 with offset. */
  startedAt: string;
  /** Null while the fast is running. */
  endedAt: string | null;
  targetHours: number;
  /** A `FastingProtocolId`, or "custom". Plain text so new presets need no migration. */
  protocol: string;
  note: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type FastingCurrentResponse = {
  /** Null when nothing is running — which is a state, not an error. */
  session: FastingSessionDto | null;
};

export type FastingSessionResponse = { session: FastingSessionDto };

export type FastingSessionsResponse = {
  sessions: FastingSessionDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type FastingProtocolId = "16:8" | "18:6" | "20:4" | "omad" | "custom";

export type FastingProtocol = {
  id: FastingProtocolId;
  label: string;
  /** Fasting window in hours; the eating window is 24 − this. */
  targetHours: number;
  description: string;
};

/**
 * The presets offered on the timer.
 *
 * Shared so the client and server agree on what "16:8" means in hours — the
 * client sends `targetHours` explicitly, but a preset that disagreed across the
 * two would show one number and score against another.
 *
 * `custom` carries a nominal 16 h; the caller always overrides it, and it is
 * here so the id space is total rather than having a preset-shaped hole.
 */
export const FASTING_PROTOCOLS: readonly FastingProtocol[] = [
  {
    id: "16:8",
    label: "16:8",
    targetHours: 16,
    description: "16 hours fasting, 8 hour eating window",
  },
  {
    id: "18:6",
    label: "18:6",
    targetHours: 18,
    description: "18 hours fasting, 6 hour eating window",
  },
  {
    id: "20:4",
    label: "20:4",
    targetHours: 20,
    description: "20 hours fasting, 4 hour eating window",
  },
  {
    id: "omad",
    label: "OMAD",
    targetHours: 23,
    description: "One meal a day",
  },
  {
    id: "custom",
    label: "Custom",
    targetHours: 16,
    description: "Pick your own window",
  },
] as const;

/** Bounds mirroring the fasting_sessions CHECK constraint. */
export const FASTING_MIN_HOURS = 1;
export const FASTING_MAX_HOURS = 72;

export function fastingProtocol(id: string): FastingProtocol | null {
  return FASTING_PROTOCOLS.find((p) => p.id === id) ?? null;
}

/**
 * Hours elapsed since a fast began, as a float.
 *
 * Clamped at zero rather than going negative: a device clock that is briefly
 * behind the server's should read "just started", not "-0.2 hours in".
 */
export function elapsedHours(startedAt: string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(startedAt).getTime();
  return Math.max(0, ms / 3_600_000);
}
