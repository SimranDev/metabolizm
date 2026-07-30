import { useLocalSearchParams } from "expo-router";

import { AddFoodScreen } from "@/components/log/add-food-screen";
import { toOpeningMethod } from "@/components/log/sample-food-search";

/**
 * Modal route for adding food to a meal. `meal` is the meal id (e.g. "dinner")
 * passed from the Log tab's "+" buttons; it drives the title and CTA label.
 *
 * `method` names which input tile opens selected, for callers that arrive with
 * an intent already — the add sheet's "Search" cell, which is opened from the
 * tab bar rather than from a meal. It is normalized rather than trusted, so a
 * stale or hand-typed link cannot land the screen on a method it can't render.
 */
export default function AddFoodRoute() {
  const { meal, method } = useLocalSearchParams<{ meal?: string; method?: string }>();
  return <AddFoodScreen meal={meal ?? "breakfast"} method={toOpeningMethod(method)} />;
}
