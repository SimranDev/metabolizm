import { FontAwesomeFreeSolid } from "@react-native-vector-icons/fontawesome-free-solid";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useFoodSearch } from "@/hooks/use-food-search";
import { useTheme } from "@/hooks/use-theme";
import { toMealId, useDiary } from "@/store/diary";
import { useFoodSelection } from "@/store/food-selection";

import type { FoodSearchItem } from "@/lib/food";

import {
  FOOD_FILTERS,
  INPUT_METHODS,
  mealLabel,
  type FoodFilterId,
  type InputMethodId,
} from "./sample-food-search";

type Props = {
  /** Meal id from the route (e.g. "dinner"); drives the title and CTA label. */
  meal: string;
};

/**
 * Food-adding screen shown as a modal from the Log tab's "+" buttons. UI only:
 * the input methods (photo/voice/barcode) are placeholders, search filters a
 * static "recent" list locally, and "Add to {meal}" just dismisses — there is no
 * food database or diary store yet. Elements are wired to state so the real
 * behavior can be dropped in later.
 */
export function AddFoodScreen({ meal }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const label = mealLabel(meal);

  const addEntries = useDiary((s) => s.addEntries);
  const recentFoods = useDiary((s) => s.recentFoods);

  // The multi-select lives in a store (not local state) so the pushed
  // nutrition-info screen can add a configured food to it. Cleared on mount so
  // each add-food session starts fresh; the full items resolve the footer even
  // for live USDA results whose ids aren't in the recents list.
  const selectedItems = useFoodSelection((s) => s.items);
  const toggle = useFoodSelection((s) => s.toggle);
  const clearSelection = useFoodSelection((s) => s.clear);
  useEffect(() => {
    clearSelection();
  }, [clearSelection]);

  const [method, setMethod] = useState<InputMethodId>("search");
  const [filter, setFilter] = useState<FoodFilterId>("all");
  const [query, setQuery] = useState("");

  const { items, loading, error } = useFoodSearch(query);

  // Live USDA search when a query is typed; the static RECENT list otherwise.
  // Meals / My Foods have no data source yet, so they stay empty.
  const trimmed = query.trim();
  const searchable = filter !== "meals" && filter !== "myfoods";
  const showingSearch = searchable && trimmed.length > 0;
  const list = !searchable ? [] : showingSearch ? items : recentFoods;

  const selected = Object.values(selectedItems);
  const selectedCalories = selected.reduce((sum, f) => sum + f.calories, 0);

  return (
    <ThemedView style={styles.container}>
      <Header meal={label} onBack={() => router.back()} onClose={() => router.back()} insetTop={insets.top} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.methods}>
          {INPUT_METHODS.map((m) => (
            <MethodButton
              key={m.id}
              icon={m.icon}
              label={m.label}
              active={method === m.id}
              onPress={() => setMethod(m.id)}
            />
          ))}
        </View>

        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
          <FontAwesomeFreeSolid name="magnifying-glass" size={16} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for a food"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={Spacing.two}>
              <FontAwesomeFreeSolid name="xmark" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={[styles.filters, { borderBottomColor: theme.backgroundSelected }]}>
          {FOOD_FILTERS.map((f) => (
            <FilterTab key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </View>

        {method !== "search" ? (
          <MethodPlaceholder method={method} />
        ) : showingSearch && loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        ) : showingSearch && error ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyState}>
            {error}
          </ThemedText>
        ) : list.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyState}>
            {showingSearch ? `No foods matching "${trimmed}"` : "Nothing here yet"}
          </ThemedText>
        ) : (
          <View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              {showingSearch ? "RESULTS" : "RECENT"}
            </ThemedText>
            {list.map((item) => (
              <FoodRow
                key={item.id}
                item={item}
                selected={!!selectedItems[item.id]}
                onToggle={() => toggle(item)}
                onOpen={() =>
                  router.push({
                    pathname: "/food-detail",
                    params: { fdcId: item.id, meal, mode: "add" },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Footer
        count={selected.length}
        calories={selectedCalories}
        mealName={label}
        insetBottom={insets.bottom}
        onAdd={() => {
          addEntries(toMealId(meal), selected);
          router.back();
        }}
      />
    </ThemedView>
  );
}

function Header({
  meal,
  onBack,
  onClose,
  insetTop,
}: {
  meal: string;
  onBack: () => void;
  onClose: () => void;
  insetTop: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insetTop + Spacing.two, borderBottomColor: theme.backgroundSelected },
      ]}>
      <View style={styles.headerSide}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}>
          <FontAwesomeFreeSolid name="arrow-left" size={20} color={theme.text} />
        </Pressable>
      </View>

      {/* Meal switcher — placeholder; opening a picker comes later. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Adding to ${meal}. Change meal`}
        style={({ pressed }) => [styles.titleButton, pressed && styles.pressed]}>
        <ThemedText style={styles.title}>{meal}</ThemedText>
        <FontAwesomeFreeSolid name="chevron-down" size={13} color={theme.text} />
      </Pressable>

      <View style={[styles.headerSide, styles.headerSideRight]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={Spacing.two}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <FontAwesomeFreeSolid name="xmark" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function MethodButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: FoodSearchIconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const fg = active ? "#ffffff" : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.method,
        { backgroundColor: active ? theme.tint : theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <FontAwesomeFreeSolid name={icon} size={22} color={fg} />
      <ThemedText type="smallBold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FilterTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.filterTab, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor={active ? "text" : "textSecondary"}>
        {label}
      </ThemedText>
      <View style={[styles.filterUnderline, { backgroundColor: active ? theme.text : "transparent" }]} />
    </Pressable>
  );
}

function FoodRow({
  item,
  selected,
  onToggle,
  onOpen,
}: {
  item: FoodSearchItem;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.foodRow, { borderBottomColor: theme.backgroundSelected }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name} details`}
        onPress={onOpen}
        style={({ pressed }) => [styles.foodInfo, pressed && styles.pressed]}>
        <View style={styles.foodNameRow}>
          <ThemedText style={styles.foodName} numberOfLines={1}>
            {item.name}
          </ThemedText>
          {item.verified && (
            <FontAwesomeFreeSolid name="circle-check" size={14} color={theme.tint} />
          )}
        </View>
        <View style={styles.foodMetaRow}>
          <View style={[styles.dot, { backgroundColor: theme[item.accent] }]} />
          <ThemedText type="small" themeColor="textSecondary">
            {item.calories.toLocaleString()} Cal · {item.serving}
          </ThemedText>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={selected ? `Remove ${item.name}` : `Add ${item.name}`}
        onPress={onToggle}
        hitSlop={Spacing.two}
        style={({ pressed }) => [
          styles.addCircle,
          { borderColor: theme.tint, backgroundColor: selected ? theme.tint : "transparent" },
          pressed && styles.pressed,
        ]}>
        <FontAwesomeFreeSolid name={selected ? "check" : "plus"} size={14} color={selected ? "#ffffff" : theme.tint} />
      </Pressable>
    </View>
  );
}

function MethodPlaceholder({ method }: { method: InputMethodId }) {
  const theme = useTheme();
  const copy: Record<Exclude<InputMethodId, "search">, { icon: FoodSearchIconName; text: string }> = {
    photo: { icon: "camera", text: "Snap a photo of your meal — coming soon." },
    voice: { icon: "microphone", text: "Log by voice — coming soon." },
    barcode: { icon: "barcode", text: "Scan a barcode — coming soon." },
  };
  const { icon, text } = copy[method as Exclude<InputMethodId, "search">];
  return (
    <View style={styles.placeholder}>
      <FontAwesomeFreeSolid name={icon} size={32} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.placeholderText}>
        {text}
      </ThemedText>
    </View>
  );
}

function Footer({
  count,
  calories,
  mealName,
  insetBottom,
  onAdd,
}: {
  count: number;
  calories: number;
  mealName: string;
  insetBottom: number;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const disabled = count === 0;
  return (
    <ThemedView
      style={[
        styles.footer,
        { paddingBottom: insetBottom + Spacing.two, borderTopColor: theme.backgroundSelected },
      ]}>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {count} {count === 1 ? "item" : "items"} selected
        </ThemedText>
        <ThemedText style={styles.footerCalories}>{calories.toLocaleString()} cal</ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={`Add to ${mealName}`}
        disabled={disabled}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addToMeal,
          { backgroundColor: theme.tint, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        ]}>
        <ThemedText style={styles.addToMealText}>Add to {mealName}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

type FoodSearchIconName = (typeof INPUT_METHODS)[number]["icon"];

const CIRCLE = 34;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    flex: 1,
    justifyContent: "center",
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  titleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  title: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  closeButton: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  methods: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  method: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 48,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 16,
    // Trim RN's default vertical padding so the text sits centered in the pill.
    paddingVertical: 0,
  },
  filters: {
    flexDirection: "row",
    gap: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  filterUnderline: {
    height: 2,
    borderRadius: 1,
    // Pull the underline down onto the row's bottom border.
    marginBottom: -StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    letterSpacing: 1.2,
    marginBottom: Spacing.one,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  foodInfo: {
    flex: 1,
    gap: Spacing.one,
  },
  foodNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  foodName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  foodMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  placeholderText: {
    textAlign: "center",
  },
  emptyState: {
    textAlign: "center",
    paddingVertical: Spacing.five,
  },
  centerState: {
    alignItems: "center",
    paddingVertical: Spacing.five,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerCalories: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  addToMeal: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  addToMealText: {
    color: "#ffffff",
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
