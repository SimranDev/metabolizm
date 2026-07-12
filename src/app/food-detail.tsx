import { useLocalSearchParams } from "expo-router";

import { FoodDetailScreen } from "@/components/log/food-detail-screen";

/**
 * Modal route for the nutrition-info screen. Opened from a search-result row
 * ("add" mode) or a logged food ("edit" mode); `fdcId` is the USDA food id and
 * `meal` the target meal. In edit mode `entryId` identifies the diary entry.
 */
export default function FoodDetailRoute() {
  const { fdcId, meal, mode, entryId } = useLocalSearchParams<{
    fdcId?: string;
    meal?: string;
    mode?: string;
    entryId?: string;
  }>();

  return (
    <FoodDetailScreen
      fdcId={fdcId ?? ""}
      meal={meal ?? "breakfast"}
      mode={mode === "edit" ? "edit" : "add"}
      entryId={entryId}
    />
  );
}
