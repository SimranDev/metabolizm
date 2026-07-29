import { FontAwesomeFreeSolid } from "@react-native-vector-icons/fontawesome-free-solid";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { useFoodDetail } from "@/hooks/use-food-detail";
import { ApiError, reportFood } from "@/lib/api";
import { useCurrentUserId } from "@/lib/auth";
import { buildUnits, displayName, dominantMacro, scaleFood } from "@/lib/food";
import type { DiaryFood, FoodUnit } from "@metabolizm/shared";
import { toMealId, useDiary } from "@/store/diary";
import { useFoodSelection } from "@/store/food-selection";
import { Spacing, useTheme } from "@/theme";

import { NutritionFacts } from "./nutrition-facts";
import { UnitPicker } from "./unit-picker";

type Props = {
  /** Catalog food id to fetch details for. */
  foodId: string;
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
export function FoodDetailScreen({ foodId, meal, mode, entryId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { detail, loading, error, reload } = useFoodDetail(foodId);
  const currentUserId = useCurrentUserId();
  const upsert = useFoodSelection((s) => s.upsert);
  const updateEntry = useDiary((s) => s.updateEntry);
  const existingEntry = useDiary((s) =>
    mode === "edit" && entryId
      ? (s.entriesByDate[s.currentDate]?.[toMealId(meal)] ?? []).find((e) => e.entryId === entryId)
      : undefined,
  );

  // Defaults come from the food's own portions (or the logged entry when
  // editing); overrides track the user's edits, so no init effect / cascading
  // setState.
  const { units, defaultUnitIndex } = detail
    ? buildUnits(detail)
    : { units: [] as FoodUnit[], defaultUnitIndex: 0 };
  const seedUnit = units[defaultUnitIndex] ?? units[0];
  const defaultUnit = existingEntry?.unit ?? seedUnit ?? null;
  const defaultQuantity = existingEntry?.quantity != null ? String(existingEntry.quantity) : "1";
  const [unitOverride, setUnitOverride] = useState<FoodUnit | null>(null);
  const [quantityOverride, setQuantityOverride] = useState<string | null>(null);
  const unit = unitOverride ?? defaultUnit;
  const quantity = quantityOverride ?? defaultQuantity;

  const qty = Number(quantity);
  const validQty = Number.isFinite(qty) && qty > 0;
  // Amount in base units (g|ml); all catalog values are per 100 of them.
  const scaled = detail && unit ? scaleFood(detail, qty * unit.grams) : null;
  const canSave = !!detail && !!unit && !!scaled && validQty;

  const onSave = () => {
    if (!detail || !unit || !scaled || !validQty) return;
    const serving = servingText(qty, unit);
    const macros = {
      proteinG: scaled.proteinG,
      carbsG: scaled.carbsG,
      fatG: scaled.fatG,
    };
    if (mode === "edit" && entryId) {
      updateEntry(toMealId(meal), entryId, {
        serving,
        calories: scaled.calories,
        macros,
        quantity: qty,
        unit,
      });
    } else {
      const food: DiaryFood = {
        foodId: detail.id,
        name: displayName(detail.name, detail.brand),
        serving,
        calories: scaled.calories,
        macros,
        accent: dominantMacro(detail.proteinG, detail.carbsG, detail.fatG),
        verified: detail.isVerified,
        quantity: qty,
        unit,
      };
      upsert(food);
    }
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.s8, borderBottomColor: colors.border },
        ]}>
        <IconButton
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          icon={(color) => <FontAwesomeFreeSolid name="arrow-left" size={18} color={color} />}
        />

        <ThemedText type="h3" style={styles.title} numberOfLines={1}>
          {detail ? displayName(detail.name, detail.brand) : "Nutrition facts"}
        </ThemedText>

        <Button label="Save" size="sm" disabled={!canSave} onPress={onSave} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : error || !detail || !scaled || !unit ? (
        <View style={styles.centerState}>
          <ThemedText type="sm" themeColor="textSecondary" style={styles.errorText}>
            {error ?? "Couldn't load nutrition details."}
          </ThemedText>
          <Button label="Try again" variant="secondary" size="sm" onPress={reload} />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Trust state is always rendered as SOMETHING — verified badge or
                a designed unverified chip — never as an absent badge the user
                has to interpret. Same rule as the groups locked chip. */}
            <View style={styles.trustRow}>
              {detail.isVerified ? (
                <Badge
                  label="Verified"
                  size="sm"
                  variant="neutral"
                  icon={(color) => (
                    <FontAwesomeFreeSolid name="circle-check" size={12} color={color} />
                  )}
                />
              ) : detail.ownerId !== null ? (
                <Badge label="Unverified · added by a member" size="sm" variant="outline" />
              ) : null}
            </View>

            <NutritionFacts
              calories={scaled.calories}
              proteinG={scaled.proteinG}
              carbsG={scaled.carbsG}
              fatG={scaled.fatG}
              nutrients={scaled.nutrients}
              servingLabel={servingText(qty, unit)}
            />

            <ReportFoodRow
              foodId={detail.id}
              ownedByCaller={detail.ownerId !== null && detail.ownerId === currentUserId}
            />
          </ScrollView>

          <ThemedView
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + Spacing.s8, borderTopColor: colors.border },
            ]}>
            <View style={styles.quantityCol}>
              <Input
                label="Quantity"
                numeric
                value={quantity}
                onChangeText={setQuantityOverride}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholder="0"
                accessibilityLabel="Quantity"
              />
            </View>
            <View style={styles.unitCol}>
              <UnitPicker units={units} value={unit} onChange={setUnitOverride} />
            </View>
          </ThemedView>
        </>
      )}
    </ThemedView>
  );
}

/**
 * "Report this food." Inline rather than a sheet — it is a two-field
 * interaction and pulling in a bottom-sheet library for it would cost more
 * bundle than the whole feature. Hidden for the caller's own foods, which the
 * server rejects anyway (they can edit or delete instead).
 */
function ReportFoodRow({
  foodId,
  ownedByCaller,
}: {
  foodId: string;
  ownedByCaller: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (ownedByCaller) return null;

  if (state === "sent") {
    return (
      <View style={styles.reportBlock}>
        <ThemedText type="sm" themeColor="textSecondary">
          Thanks — we&apos;ll take another look at this food.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.reportBlock}>
      {open ? (
        <>
          <Input
            label="WHAT LOOKS WRONG?"
            value={reason}
            onChangeText={setReason}
            placeholder="The energy looks like kilojoules"
            multiline
          />
          {message ? (
            <ThemedText type="sm" themeColor="danger">
              {message}
            </ThemedText>
          ) : null}
          <Button
            label={state === "sending" ? "Sending…" : "Send report"}
            size="sm"
            variant="secondary"
            disabled={reason.trim().length === 0 || state === "sending"}
            onPress={() => {
              setState("sending");
              setMessage(null);
              reportFood(foodId, reason.trim())
                .then(() => setState("sent"))
                .catch((e: unknown) => {
                  setState("error");
                  setMessage(
                    e instanceof ApiError && e.status === 409
                      ? "You've already reported this food."
                      : "Couldn't send that report.",
                  );
                });
            }}
          />
        </>
      ) : (
        <Button
          label="Report this food"
          size="sm"
          variant="ghost"
          onPress={() => setOpen(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.s16,
    paddingHorizontal: Spacing.s24,
    paddingBottom: Spacing.s8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
  },
  content: {
    padding: Spacing.s24,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.s16,
    padding: Spacing.s24,
  },
  errorText: {
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.s16,
    paddingHorizontal: Spacing.s24,
    paddingTop: Spacing.s16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quantityCol: {
    flex: 1,
  },
  unitCol: {
    flex: 1.3,
  },
  trustRow: {
    flexDirection: "row",
    paddingBottom: Spacing.s12,
  },
  reportBlock: {
    marginTop: Spacing.s24,
    gap: Spacing.s8,
  },
});
