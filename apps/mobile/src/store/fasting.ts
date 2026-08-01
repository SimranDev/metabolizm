/**
 * The fasting timer.
 *
 * MMKV is the read path, like weight and water: a running fast must survive a
 * force-quit and paint instantly on relaunch, because a timer that shows a
 * spinner where the hours should be is a timer nobody trusts.
 *
 * Only `startedAt` is cached — never an elapsed figure. Elapsed is recomputed
 * from the clock wherever it is displayed, which is what makes it correct after
 * the app has been backgrounded for fourteen hours.
 *
 * The outbox holds *operations* rather than rows, because a fast is two writes
 * (start, then end) against one id. Both are idempotent given that id, so a
 * queued pair replays in order and lands as one fast.
 */

import { uuidv7 } from "uuidv7";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ApiError, fastingApi } from "@/lib/api";
import type { FastingSessionDto } from "@metabolizm/shared";

import { zustandMmkvStorage } from "./storage";

/** Finished fasts kept on device. A few dozen bytes each. */
const HISTORY_CAP = 60;

type Status = "idle" | "loading" | "ready" | "error";

type PendingOp =
  | {
      kind: "start";
      id: string;
      startedAt: string;
      targetHours: number;
      protocol: string;
    }
  | { kind: "end"; id: string; endedAt: string };

type PersistedFasting = {
  current: FastingSessionDto | null;
  sessions: FastingSessionDto[];
  pending: PendingOp[];
};

type FastingState = PersistedFasting & {
  status: Status;
  error: string | null;
  refresh: () => Promise<void>;
  startFast: (input: { targetHours: number; protocol: string }) => Promise<void>;
  endFast: () => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  flushPending: () => Promise<void>;
  /** Drop everything cached for the signed-in account. See lib/session. */
  reset: () => void;
};

const message = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong.";

/** Newest first, de-duplicated by id, capped. Finished fasts only. */
function mergeSessions(
  existing: FastingSessionDto[],
  incoming: FastingSessionDto[],
): FastingSessionDto[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const session of incoming) byId.set(session.id, session);
  return [...byId.values()]
    .filter((s) => s.deletedAt === null && s.endedAt !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, HISTORY_CAP);
}

const initial: PersistedFasting = {
  current: null,
  sessions: [],
  pending: [],
};

export const useFasting = create<FastingState>()(
  persist(
    (set, get) => ({
      ...initial,
      status: "idle",
      error: null,

      reset: () => set({ ...initial, status: "idle", error: null }),

      refresh: async () => {
        set({ status: "loading", error: null });
        try {
          await get().flushPending();
          const [{ session }, history] = await Promise.all([
            fastingApi.getCurrent(),
            fastingApi.listSessions({ limit: HISTORY_CAP }),
          ]);
          set((state) => ({
            current: session,
            sessions: mergeSessions(state.sessions, history.sessions),
            status: "ready",
            error: null,
          }));
        } catch (err) {
          // Keep whatever is on disk visible — a failed refresh must not blank
          // a running timer the user can still read off the clock.
          set({ status: "error", error: message(err) });
        }
      },

      startFast: async ({ targetHours, protocol }) => {
        if (get().current) return;

        const now = new Date();
        const optimistic: FastingSessionDto = {
          // Client-generated, so the retry after a failed send is an
          // idempotent upsert rather than a second overlapping fast.
          id: uuidv7(),
          startedAt: now.toISOString(),
          endedAt: null,
          targetHours,
          protocol,
          note: null,
          version: 1,
          updatedAt: now.toISOString(),
          deletedAt: null,
        };
        set({ current: optimistic });

        try {
          const { session } = await fastingApi.startFast({
            id: optimistic.id,
            startedAt: optimistic.startedAt,
            targetHours,
            protocol,
          });
          set({ current: session });
        } catch (err) {
          // A 409 means the server already has a fast running — the local
          // optimistic one is wrong, so take the server's answer instead of
          // queueing a start that will never succeed.
          if (err instanceof ApiError && err.status === 409) {
            set({ current: null, error: message(err) });
            void get().refresh();
            return;
          }
          set((state) => ({
            pending: [
              ...state.pending,
              {
                kind: "start",
                id: optimistic.id,
                startedAt: optimistic.startedAt,
                targetHours,
                protocol,
              },
            ],
            error: message(err),
          }));
        }
      },

      endFast: async () => {
        const running = get().current;
        if (!running) return;

        const endedAt = new Date().toISOString();
        const finished: FastingSessionDto = { ...running, endedAt };
        set((state) => ({
          current: null,
          sessions: mergeSessions(state.sessions, [finished]),
        }));

        try {
          const { session } = await fastingApi.patchFast(running.id, { endedAt });
          set((state) => ({ sessions: mergeSessions(state.sessions, [session]) }));
        } catch (err) {
          // 409 is "already ended" — the desired state, reached by an earlier
          // attempt that did land. Nothing to queue.
          if (err instanceof ApiError && err.status === 409) {
            void get().refresh();
            return;
          }
          set((state) => ({
            pending: [...state.pending, { kind: "end", id: running.id, endedAt }],
            error: message(err),
          }));
        }
      },

      removeSession: async (id) => {
        const previous = get().sessions;
        set({ sessions: previous.filter((s) => s.id !== id) });
        try {
          await fastingApi.deleteSession(id);
        } catch (err) {
          // Put it back — silently losing a record is worse than the failure.
          set({ sessions: previous, error: message(err) });
        }
      },

      flushPending: async () => {
        const queued = get().pending;
        if (queued.length === 0) return;
        const sent: string[] = [];
        for (const op of queued) {
          try {
            if (op.kind === "start") {
              await fastingApi.startFast({
                id: op.id,
                startedAt: op.startedAt,
                targetHours: op.targetHours,
                protocol: op.protocol,
              });
            } else {
              await fastingApi.patchFast(op.id, { endedAt: op.endedAt });
            }
            sent.push(`${op.kind}:${op.id}`);
          } catch (err) {
            // 409 means the server is already in the state this op wanted, so
            // it is done rather than stuck. Anything else is still offline —
            // keep the rest queued, in order, and try again next time.
            if (err instanceof ApiError && err.status === 409) {
              sent.push(`${op.kind}:${op.id}`);
              continue;
            }
            break;
          }
        }
        if (sent.length > 0) {
          set((state) => ({
            pending: state.pending.filter(
              (op) => !sent.includes(`${op.kind}:${op.id}`),
            ),
          }));
        }
      },
    }),
    {
      name: "metabolizm-fasting",
      version: 1,
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state): PersistedFasting => ({
        current: state.current,
        sessions: state.sessions,
        pending: state.pending,
      }),
      // Status is always derived fresh — a persisted "ready" would hide the
      // first refresh of the session.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedFasting>;
        return {
          ...current,
          current: saved.current ?? null,
          sessions: saved.sessions ?? [],
          pending: saved.pending ?? [],
        };
      },
    },
  ),
);
