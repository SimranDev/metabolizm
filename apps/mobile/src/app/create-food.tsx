import { useLocalSearchParams } from "expo-router";

import { CreateFoodScreen } from "@/components/log/create-food-screen";

/**
 * Modal route for creating a food. `name` seeds the name field from whatever
 * the user was searching for when they gave up and tapped "Can't find it?";
 * `barcode` is prefilled when they arrive from a scan that found nothing.
 */
export default function CreateFoodRoute() {
  const { name, barcode } = useLocalSearchParams<{ name?: string; barcode?: string }>();
  return <CreateFoodScreen initialName={name} initialBarcode={barcode} />;
}
