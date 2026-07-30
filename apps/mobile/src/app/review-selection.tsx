import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mealLabel } from '@/components/log/sample-food-search';
import { toMealId, useDiary } from '@/store/diary';
import { useFoodSelection } from '@/store/food-selection';
import {
  macroColor,
  macroSoftColor,
  macroTextColor,
  Radius,
  Spacing,
  useTheme,
  type MacroKind,
} from '@/theme';

import type { DiaryFood, Macros } from '@metabolizm/shared';

/** Legend and bar order: protein first, the macro the app's targets lead on. */
const MACRO_ORDER: readonly MacroKind[] = ['protein', 'carbs', 'fat'];

const KCAL_PER_G: Record<MacroKind, number> = { protein: 4, carbs: 4, fat: 9 };

/**
 * "In this meal" — the add-food selection, reviewable before it is committed.
 *
 * Reached from the dock's review row ([../components/log/selection-dock.tsx]),
 * as a native form sheet over the add-food modal, so the search results stay
 * visible behind it and the OS owns the drag-to-dismiss.
 *
 * It reads and writes the same `useFoodSelection` store the add-food screen
 * does, so removing something here is reflected in the tray the moment this
 * closes — there is no second copy of the selection to keep in step. Committing
 * from here uses `dismissAll`, since a successful add has to close this sheet
 * *and* the add-food modal underneath it.
 */
export default function ReviewSelectionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  const mealId = meal ?? 'breakfast';
  const label = mealLabel(mealId);

  const items = useFoodSelection((s) => s.items);
  const remove = useFoodSelection((s) => s.remove);
  const clear = useFoodSelection((s) => s.clear);
  const addEntries = useDiary((s) => s.addEntries);

  const selected = Object.values(items);
  const calories = selected.reduce((sum, f) => sum + f.calories, 0);
  const macros = totalMacros(selected);

  // Emptying the tray — by trash or by "Clear all" — leaves this sheet with
  // nothing to review, so it closes itself rather than sitting on an empty
  // list with a disabled button.
  useEffect(() => {
    if (selected.length === 0) router.back();
  }, [selected.length, router]);

  const commit = () => {
    addEntries(toMealId(mealId), selected);
    // Closes this sheet and the add-food modal it opened over.
    router.dismissAll();
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.handleRow}>
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
      </View>

      <View style={styles.header}>
        <ThemedText type="h3" themeColor="inkStrong">
          In this {label.toLowerCase()}
        </ThemedText>
        <Badge label={String(selected.length)} variant="accent" size="sm" />
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear all ${selected.length} items`}
          onPress={clear}
          hitSlop={Spacing.s8}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smBold" themeColor="textSecondary">
            Clear all
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {selected.map((item) => (
          <SelectedRow key={item.foodId} item={item} onRemove={() => remove(item.foodId)} />
        ))}

        <View style={[styles.totals, { borderTopColor: colors.border }]}>
          <View style={styles.totalRow}>
            <ThemedText type="micro" themeColor="textSecondary">
              Meal total
            </ThemedText>
            <ThemedText type="statSm" tabular>
              {calories.toLocaleString()} kcal
            </ThemedText>
          </View>

          <MacroSplit macros={macros} />

          <View style={styles.legend}>
            {MACRO_ORDER.map((macro) => (
              <View key={macro} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: macroColor(colors, macro) }]} />
                <ThemedText type="sm" themeColor="textSecondary" tabular>
                  {Math.round(gramsOf(macros, macro))} g {macro}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label={`Add ${selected.length} ${selected.length === 1 ? 'item' : 'items'} to ${label.toLowerCase()}`}
          onPress={commit}
          size="lg"
          fullWidth
        />
      </View>
    </ThemedView>
  );
}

/**
 * One selected food. The trailing figure is its dominant macro — the same
 * `accent` the tray tints by and the list row dots — so the row says why this
 * food is in the meal, not just that it is.
 */
function SelectedRow({ item, onRemove }: { item: DiaryFood; onRemove: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: macroSoftColor(colors, item.accent),
            borderColor: macroTextColor(colors, item.accent),
          },
        ]}>
        <ThemedText type="smBold" style={{ color: macroTextColor(colors, item.accent) }}>
          {item.name.trim().charAt(0).toUpperCase() || '?'}
        </ThemedText>
      </View>

      <View style={styles.rowText}>
        <ThemedText type="smBold" numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText type="sm" themeColor="textSecondary" tabular numberOfLines={1}>
          {item.calories.toLocaleString()} kcal · {item.serving} ·{' '}
          {Math.round(gramsOf(item.macros, item.accent))} g {item.accent}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
        onPress={onRemove}
        hitSlop={Spacing.s4}
        style={({ pressed }) => [
          styles.trash,
          { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
          pressed && styles.pressed,
        ]}>
        <FontAwesomeFreeSolid name="trash" size={14} color={colors.dangerText} />
      </Pressable>
    </View>
  );
}

/**
 * How the meal's calories split across the three macros.
 *
 * Segments are sized by **energy**, not grams, matching `MacroBar` — a gram of
 * fat carries 9 kcal against protein's 4, so a grams-proportional bar would
 * show fat as a slimmer share of the meal than it actually contributes. The
 * legend beside it still reads in grams, which is what a label states.
 */
function MacroSplit({ macros }: { macros: Macros }) {
  const { colors } = useTheme();

  const kcal = MACRO_ORDER.map((macro) => gramsOf(macros, macro) * KCAL_PER_G[macro]);
  const total = kcal.reduce((sum, n) => sum + n, 0);

  return (
    <View style={[styles.splitTrack, { backgroundColor: colors.ringTrack }]}>
      {total > 0
        ? MACRO_ORDER.map((macro, i) => (
            <View key={macro} style={{ flex: kcal[i], backgroundColor: macroColor(colors, macro) }} />
          ))
        : null}
    </View>
  );
}

function gramsOf(macros: Macros, macro: MacroKind): number {
  return macro === 'protein' ? macros.proteinG : macro === 'carbs' ? macros.carbsG : macros.fatG;
}

function totalMacros(items: DiaryFood[]): Macros {
  return items.reduce<Macros>(
    (sum, f) => ({
      proteinG: sum.proteinG + f.macros.proteinG,
      carbsG: sum.carbsG + f.macros.carbsG,
      fatG: sum.fatG + f.macros.fatG,
    }),
    { proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

const CHIP = 34;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.s8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s8,
    paddingHorizontal: Spacing.s20,
    paddingTop: Spacing.s12,
    paddingBottom: Spacing.s8,
  },
  spacer: {
    flex: 1,
  },
  body: {
    paddingHorizontal: Spacing.s20,
    paddingBottom: Spacing.s16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
    paddingVertical: Spacing.s12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  trash: {
    width: CHIP,
    height: CHIP,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totals: {
    marginTop: Spacing.s16,
    paddingTop: Spacing.s16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.s12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: Spacing.s20,
    paddingTop: Spacing.s12,
    paddingBottom: Spacing.s32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
