import { FontAwesomeFreeSolid } from "@react-native-vector-icons/fontawesome-free-solid";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useFoodDetail } from "@/hooks/use-food-detail";
import { useTheme } from "@/hooks/use-theme";
import { scaleNutrition, type FoodSearchItem, type FoodUnit } from "@/lib/food";
import { toMealId, useDiary } from "@/store/diary";
import { useFoodSelection } from "@/store/food-selection";

import { NutritionFacts } from "./nutrition-facts";
import { UnitPicker } from "./unit-picker";

type Props = {
  /** USDA food id to fetch details for. */
  fdcId: string;
  /** Meal id from the route — the CTA target / the meal to update in edit mode. */
  meal: string;
  /** "add" configures a new selection; "edit" updates an already-logged entry. */
  mode: "add" | "edit";
  /** The diary entry being edited (edit mode only). */
  entryId?: string;
};

/** Base units read plainly ("250 Grams"); portions read as their own label ("1 cup (39 g)"). */
const SIMPLE_UNITS = new Set(["Grams", "Ounces", "Milliliters", "Fluid ounces"]);

const trimQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function servingText(qty: number, unit: FoodUnit): string {
  if (SIMPLE_UNITS.has(unit.label)) return `${trimQty(qty)} ${unit.label}`;
  return qty === 1 ? unit.label : `${trimQty(qty)} × ${unit.label}`;
}

/**
 * Nutrition-info screen: a live FDA-style label for a chosen amount of one food,
 * with an editable quantity + unit. Opened from a search row ("add" — Save marks
 * it selected with the chosen amount) or a logged food ("edit" — Save updates the
 * entry in place). Detail data is fetched lazily on open.
 */
export function FoodDetailScreen({ fdcId, meal, mode, entryId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const { detail, loading, error, reload } = useFoodDetail(fdcId);
  const upsert = useFoodSelection((s) => s.upsert);
  const updateEntry = useDiary((s) => s.updateEntry);
  const existingEntry = useDiary((s) =>
    mode === "edit" && entryId
      ? (s.entriesByDate[s.currentDate]?.[toMealId(meal)] ?? []).find((e) => e.entryId === entryId)
      : undefined,
  );

  // Defaults come from the food's own serving (or the logged entry when editing);
  // overrides track the user's edits, so no init effect / cascading setState.
  const seedUnit = detail ? detail.units[detail.defaultUnitIndex] ?? detail.units[0] : undefined;
  const defaultUnit = existingEntry?.unit ?? seedUnit ?? null;
  const defaultQuantity = existingEntry?.quantity != null ? String(existingEntry.quantity) : "1";
  const [unitOverride, setUnitOverride] = useState<FoodUnit | null>(null);
  const [quantityOverride, setQuantityOverride] = useState<string | null>(null);
  const unit = unitOverride ?? defaultUnit;
  const quantity = quantityOverride ?? defaultQuantity;

  const qty = Number(quantity);
  const validQty = Number.isFinite(qty) && qty > 0;
  const nutrition = detail && unit ? scaleNutrition(detail.per100g, qty * unit.grams) : null;
  const canSave = !!detail && !!unit && !!nutrition && validQty;

  const onSave = () => {
    if (!detail || !unit || !nutrition || !validQty) return;
    const serving = servingText(qty, unit);
    const macros = {
      proteinG: nutrition.proteinG,
      carbsG: nutrition.carbsG,
      fatG: nutrition.fatG,
    };
    if (mode === "edit" && entryId) {
      updateEntry(toMealId(meal), entryId, {
        serving,
        calories: nutrition.calories,
        macros,
        quantity: qty,
        unit,
      });
    } else {
      const item: FoodSearchItem = {
        id: detail.id,
        name: detail.name,
        calories: nutrition.calories,
        serving,
        macros,
        accent: detail.accent,
        verified: detail.verified,
        quantity: qty,
        unit,
      };
      upsert(item);
    }
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.backgroundSelected },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={Spacing.two}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <FontAwesomeFreeSolid name="arrow-left" size={18} color={theme.text} />
        </Pressable>

        <ThemedText style={styles.title} numberOfLines={1}>
          {detail?.name ?? "Nutrition facts"}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          accessibilityLabel="Save"
          disabled={!canSave}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.tint, opacity: !canSave ? 0.4 : pressed ? 0.8 : 1 },
          ]}>
          <ThemedText style={styles.saveText}>Save</ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : error || !detail || !nutrition || !unit ? (
        <View style={styles.centerState}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
            {error ?? "Couldn't load nutrition details."}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={reload}
            style={({ pressed }) => [
              styles.retry,
              { borderColor: theme.tint },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" themeColor="tint">
              Try again
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <NutritionFacts nutrition={nutrition} servingLabel={servingText(qty, unit)} />
          </ScrollView>

          <ThemedView
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + Spacing.two, borderTopColor: theme.backgroundSelected },
            ]}>
            <View style={styles.quantityCol}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
                QUANTITY
              </ThemedText>
              <TextInput
                value={quantity}
                onChangeText={setQuantityOverride}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Quantity"
                style={[
                  styles.quantityInput,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />
            </View>
            <View style={styles.unitCol}>
              <UnitPicker units={detail.units} value={unit} onChange={setUnitOverride} />
            </View>
          </ThemedView>
        </>
      )}
    </ThemedView>
  );
}

const CIRCLE = 34;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  saveButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  saveText: {
    color: "#ffffff",
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
  },
  content: {
    padding: Spacing.four,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  errorText: {
    textAlign: "center",
  },
  retry: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1.5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quantityCol: {
    flex: 1,
  },
  unitCol: {
    flex: 1.3,
  },
  caps: {
    letterSpacing: 1.2,
    marginBottom: Spacing.one,
  },
  quantityInput: {
    height: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    // Trim RN's default vertical padding so the value sits centered in the box.
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});
