import {
  FontAwesomeFreeSolid,
  type FontAwesomeFreeSolidIconName,
} from "@react-native-vector-icons/fontawesome-free-solid";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { FoodAccent } from "@/lib/food";
import { mealCalories, type DiaryEntry, type Meal } from "@/store/diary";

const FOOD_TILE = 40;
const ADD_BUTTON = 26;

/** A representative food glyph per dominant macro (logged foods carry no icon). */
const ACCENT_ICON: Record<FoodAccent, FontAwesomeFreeSolidIconName> = {
  protein: "drumstick-bite",
  carbs: "wheat-alt",
  fat: "droplet",
};

type Props = {
  meal: Meal;
};

/**
 * One meal on the Log tab: a header (name · total calories · add button) above
 * either a card of logged food entries or, when nothing is logged, a dashed
 * "Add {meal}" button. Both the header "+" and the empty-state button open the
 * add-food modal for this meal.
 */
export function MealSection({ meal }: Props) {
  const router = useRouter();
  const total = mealCalories(meal);
  const openAddFood = () => router.push({ pathname: "/add-food", params: { meal: meal.id } });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.mealLabel}>{meal.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {total.toLocaleString()} cal
          </ThemedText>
        </View>
        <AddButton label={`Add food to ${meal.label.toLowerCase()}`} onPress={openAddFood} />
      </View>

      {meal.entries.length === 0 ? (
        <EmptyMealButton label={meal.label} onPress={openAddFood} />
      ) : (
        <Card style={styles.card}>
          {meal.entries.map((entry, index) => (
            <View key={entry.entryId}>
              {index > 0 && <Divider />}
              <FoodEntryRow entry={entry} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function FoodEntryRow({ entry }: { entry: DiaryEntry }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${entry.serving}, ${entry.calories} calories`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ThemedView type="backgroundSelected" style={styles.tile}>
        <FontAwesomeFreeSolid name={ACCENT_ICON[entry.accent]} size={18} color={theme[entry.accent]} />
      </ThemedView>
      <View style={styles.rowText}>
        <ThemedText style={styles.foodName} numberOfLines={1}>
          {entry.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {entry.serving}
        </ThemedText>
      </View>
      <ThemedText style={styles.calories}>
        {entry.calories.toLocaleString()}
        <ThemedText type="small" themeColor="textSecondary">
          {" "}
          cal
        </ThemedText>
      </ThemedText>
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={Spacing.two}
      style={({ pressed }) => [
        styles.addButton,
        { backgroundColor: theme.tint },
        pressed && styles.pressed,
      ]}>
      <FontAwesomeFreeSolid name="plus" size={13} color="#ffffff" />
    </Pressable>
  );
}

function EmptyMealButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.empty,
        { borderColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <FontAwesomeFreeSolid name="plus" size={13} color={theme.textSecondary} />
      <ThemedText type="smallBold" themeColor="textSecondary">
        Add {label.toLowerCase()}
      </ThemedText>
    </Pressable>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.two,
  },
  mealLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  addButton: {
    width: ADD_BUTTON,
    height: ADD_BUTTON,
    borderRadius: ADD_BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // Rows own their own padding + dividers, so the card frame is flush.
  card: {
    padding: 0,
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  tile: {
    width: FOOD_TILE,
    height: FOOD_TILE,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  foodName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  calories: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
