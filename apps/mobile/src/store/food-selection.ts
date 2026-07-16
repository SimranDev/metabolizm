/**
 * The add-food screen's multi-select, lifted out of component state so the
 * pushed nutrition-info route (a separate screen) can add a configured food to
 * the same selection. Intentionally NOT persisted — it's transient UI state for
 * one add-food session; the add-food screen clears it on mount and after
 * committing to the diary.
 */

import { create } from "zustand";

import type { FoodSearchItem } from "@/lib/food";

type FoodSelectionState = {
  items: Record<string, FoodSearchItem>;
  /** Add/remove by id — the "+" quick-add on a search row. */
  toggle: (item: FoodSearchItem) => void;
  /** Add or replace by id — the nutrition-info screen's "Save" (with chosen amount). */
  upsert: (item: FoodSearchItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useFoodSelection = create<FoodSelectionState>((set) => ({
  items: {},
  toggle: (item) =>
    set((state) => {
      if (state.items[item.id]) {
        const { [item.id]: _removed, ...rest } = state.items;
        return { items: rest };
      }
      return { items: { ...state.items, [item.id]: item } };
    }),
  upsert: (item) => set((state) => ({ items: { ...state.items, [item.id]: item } })),
  remove: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.items;
      return { items: rest };
    }),
  clear: () => set({ items: {} }),
}));
