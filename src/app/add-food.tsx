import { useLocalSearchParams } from "expo-router";

import { AddFoodScreen } from "@/components/log/add-food-screen";

/**
 * Modal route for adding food to a meal. `meal` is the meal id (e.g. "dinner")
 * passed from the Log tab's "+" buttons; it drives the title and CTA label.
 */
export default function AddFoodRoute() {
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  return <AddFoodScreen meal={meal ?? "breakfast"} />;
}
