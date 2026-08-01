/**
 * Hydration log and goal.
 *
 * Same shape as the weight store, and for the same reasons: the payload is
 * tiny, so MMKV is the read path — the tile and the ring paint from disk on
 * launch, then reconcile with the server in the background. A drink logged
 * offline goes into `pending` and is flushed on the next successful read.
 *
 * The one thing that differs is what a stale cache means here. A weigh-in is a
 * measurement; a water total is a running count that the user adds to several
 * times a day. So `logWater` updates `totalMl` optimistically rather than
 * waiting for the server to tell it the new total — a quick-add that leaves the
 * ring still is a quick-add the user taps twice.
 */

import { uuidv7 } from "uuidv7";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { waterApi } from "@/lib/api";
import { localDateKey } from "@/lib/weight";
import {
  defaultWaterGoalMl,
  type WaterDayDto,
  type WaterEntryDto,
  type WaterGoalDto,
} from "@metabolizm/shared";

import { zustandMmkvStorage } from "./storage";

/** How many trailing days the detail screen's strip shows. */
export const WATER_WINDOW_DAYS = 7;

type Status = "idle" | "loading" | "ready" | "error";

/** A drink logged while offline, replayed once a request succeeds. */
type PendingLog = {
  id: string;
  entryDate: string;
  loggedAt: string;
  volumeMl: number;
};

type PersistedWater = {
  /** The local day `totalMl` and `entries` describe. */
  date: string | null;
  totalMl: number;
  goal: WaterGoalDto | null;
  entries: WaterEntryDto[];
  days: WaterDayDto[];
  streakDays: number;
  pending: PendingLog[];
};

type WaterState = PersistedWater & {
  status: Status;
  error: string | null;
  refresh: () => Promise<void>;
  logWater: (volumeMl: number) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  setGoal: (dailyGoalMl: number) => Promise<void>;
  flushPending: () => Promise<void>;
  /** Drop everything cached for the signed-in account. See lib/session. */
  reset: () => void;
};

const message = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong.";

const initial: PersistedWater = {
  date: null,
  totalMl: 0,
  goal: null,
  entries: [],
  days: [],
  streakDays: 0,
  pending: [],
};

export const useWater = create<WaterState>()(
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
          const summary = await waterApi.getSummary({ days: WATER_WINDOW_DAYS });
          set({
            date: summary.date,
            totalMl: summary.totalMl,
            goal: summary.goal,
            entries: summary.entries,
            days: summary.days,
            streakDays: summary.streakDays,
            status: "ready",
            error: null,
          });
        } catch (err) {
          // Keep whatever is on disk visible — a failed refresh shouldn't blank
          // a ring the user can still read.
          set({ status: "error", error: message(err) });
        }
      },

      logWater: async (volumeMl) => {
        const now = new Date();
        const today = localDateKey(now);
        const optimistic: WaterEntryDto = {
          // Client-generated so the retry after a failed send is an idempotent
          // upsert rather than a second drink.
          id: uuidv7(),
          entryDate: today,
          volumeMl,
          loggedAt: now.toISOString(),
          source: "manual",
          version: 1,
          updatedAt: now.toISOString(),
          deletedAt: null,
        };

        // A cached total from *yesterday* must not be added to: the device has
        // crossed midnight since the last refresh, so today starts at this
        // drink alone.
        set((state) => {
          const sameDay = state.date === today;
          return {
            date: today,
            totalMl: (sameDay ? state.totalMl : 0) + volumeMl,
            entries: [optimistic, ...(sameDay ? state.entries : [])],
          };
        });

        try {
          await waterApi.logWater({
            id: optimistic.id,
            entryDate: optimistic.entryDate,
            loggedAt: optimistic.loggedAt,
            volumeMl,
          });
          void get().refresh();
        } catch (err) {
          set((state) => ({
            pending: [
              ...state.pending,
              {
                id: optimistic.id,
                entryDate: optimistic.entryDate,
                loggedAt: optimistic.loggedAt,
                volumeMl,
              },
            ],
            error: message(err),
          }));
        }
      },

      removeEntry: async (id) => {
        const previous = get().entries;
        const removed = previous.find((e) => e.id === id);
        if (!removed) return;

        set((state) => ({
          entries: previous.filter((e) => e.id !== id),
          totalMl: Math.max(0, state.totalMl - removed.volumeMl),
        }));

        try {
          await waterApi.deleteEntry(id);
          void get().refresh();
        } catch (err) {
          // Put it back — an undo that silently lost the row would be worse
          // than the failure.
          set((state) => ({
            entries: previous,
            totalMl: state.totalMl + removed.volumeMl,
            error: message(err),
          }));
        }
      },

      setGoal: async (dailyGoalMl) => {
        const { goal } = await waterApi.putGoal({ dailyGoalMl });
        set({ goal });
        void get().refresh();
      },

      flushPending: async () => {
        const queued = get().pending;
        if (queued.length === 0) return;
        const sent: string[] = [];
        for (const item of queued) {
          try {
            await waterApi.logWater(item);
            sent.push(item.id);
          } catch {
            // Still offline — keep the rest queued and try again next time.
            break;
          }
        }
        if (sent.length > 0) {
          set((state) => ({
            pending: state.pending.filter((p) => !sent.includes(p.id)),
          }));
        }
      },
    }),
    {
      name: "metabolizm-water",
      version: 1,
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state): PersistedWater => ({
        date: state.date,
        totalMl: state.totalMl,
        goal: state.goal,
        entries: state.entries,
        days: state.days,
        streakDays: state.streakDays,
        pending: state.pending,
      }),
      // Status is always derived fresh — a persisted "ready" would hide the
      // first refresh of the session.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedWater>;
        return {
          ...current,
          date: saved.date ?? null,
          totalMl: saved.totalMl ?? 0,
          goal: saved.goal ?? null,
          entries: saved.entries ?? [],
          days: saved.days ?? [],
          streakDays: saved.streakDays ?? 0,
          pending: saved.pending ?? [],
        };
      },
    },
  ),
);

/**
 * Today's total, or null when the cache describes a different day.
 *
 * Null is "we don't know yet", not zero — the tile renders an empty state for
 * it rather than claiming the user has drunk nothing. Same promise the day
 * states make on the Log tab.
 */
export function useTodayWater(): { totalMl: number; goalMl: number } | null {
  const date = useWater((s) => s.date);
  const totalMl = useWater((s) => s.totalMl);
  const goalMl = useWater((s) => s.goal?.dailyGoalMl ?? null);

  if (date === null || date !== localDateKey(new Date())) return null;
  return { totalMl, goalMl: goalMl ?? defaultWaterGoalMl(null) };
}
