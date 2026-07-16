import { useEffect, useState } from "react";

import { searchFoods } from "@/lib/food";
import type { FoodSearchItem } from "@metabolizm/shared";

const DEBOUNCE_MS = 350;

export type FoodSearchState = {
  items: FoodSearchItem[];
  loading: boolean;
  error: string | null;
};

type Committed = { query: string; items: FoodSearchItem[]; error: string | null };

/**
 * Debounced USDA food search. Empty/whitespace queries resolve to no results and
 * no loading, so the caller can fall back to its own "recent" list. The in-flight
 * request is aborted when the query changes or the component unmounts.
 *
 * `loading` is derived (the committed result's query not matching the current
 * one) rather than set synchronously, which keeps the effect free of cascading
 * setState — and makes a repeated query resolve instantly from the last result.
 */
export function useFoodSearch(query: string): FoodSearchState {
  const q = query.trim();
  const [committed, setCommitted] = useState<Committed>({ query: "", items: [], error: null });

  useEffect(() => {
    if (!q) return;

    const controller = new AbortController();
    let active = true;

    const timer = setTimeout(() => {
      searchFoods(q, { signal: controller.signal })
        .then((items) => {
          if (active) setCommitted({ query: q, items, error: null });
        })
        .catch((err: unknown) => {
          // A superseded request rejects with AbortError — a newer effect owns the UI.
          if (err instanceof Error && err.name === "AbortError") return;
          if (active) {
            setCommitted({ query: q, items: [], error: err instanceof Error ? err.message : "Food search failed." });
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  if (!q) return { items: [], loading: false, error: null };
  // Result for the current query hasn't landed yet (debounce window or in flight).
  if (committed.query !== q) return { items: [], loading: true, error: null };
  return { items: committed.items, loading: false, error: committed.error };
}
