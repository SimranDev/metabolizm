import { useCallback, useEffect, useState } from "react";

import { getFoodDetail, type FoodDetail } from "@/lib/food";

export type FoodDetailState = {
  detail: FoodDetail | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

type Committed = { key: string; detail: FoodDetail | null; error: string | null };

/**
 * Lazily fetch one food's full detail record (per-100g nutrition, micros, and
 * portions) for the nutrition-info screen. `loading`/`error` are derived from a
 * committed result keyed by the request (fdcId + retry) rather than set
 * synchronously in the effect — mirroring `useFoodSearch`, which keeps the effect
 * free of cascading setState. The in-flight request aborts on unmount / retry.
 */
export function useFoodDetail(fdcId: string): FoodDetailState {
  const [attempt, setAttempt] = useState(0);
  const key = `${fdcId}#${attempt}`;
  const [committed, setCommitted] = useState<Committed>({ key: "", detail: null, error: null });

  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!fdcId) return;

    const controller = new AbortController();
    let active = true;

    getFoodDetail(fdcId, { signal: controller.signal })
      .then((result) => {
        if (active) setCommitted({ key, detail: result, error: null });
      })
      .catch((err: unknown) => {
        // A superseded request rejects with AbortError — a newer effect owns the UI.
        if (err instanceof Error && err.name === "AbortError") return;
        if (active) {
          setCommitted({
            key,
            detail: null,
            error: err instanceof Error ? err.message : "Couldn't load nutrition details.",
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [fdcId, key]);

  if (!fdcId) {
    return { detail: null, loading: false, error: "Nutrition details aren't available for this item.", reload };
  }
  // Result for the current request hasn't landed yet (in flight).
  if (committed.key !== key) return { detail: null, loading: true, error: null, reload };
  return { detail: committed.detail, loading: false, error: committed.error, reload };
}
