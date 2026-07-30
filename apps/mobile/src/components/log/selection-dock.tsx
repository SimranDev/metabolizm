import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { SelectionTray } from '@/components/log/selection-tray';
import { Radius, Spacing, useTheme } from '@/theme';

import type { DiaryFood } from '@metabolizm/shared';

/**
 * The add-food screen's action dock: what is in the tray, what it adds up to,
 * the way into the review sheet, and the commit button.
 *
 * **It stays above the keyboard.** Searching is the primary act on this screen,
 * so the keyboard is up for most of the session — a dock pinned to the window
 * bottom spends that whole time hidden underneath it, and the running total
 * is exactly what you want to see while typing. The lift comes from the
 * `KeyboardAvoidingView` the screen wraps this in; what this component owns is
 * dropping the safe-area padding while the keyboard is up, since the home
 * indicator is covered by the keyboard and the inset would just be a gap.
 *
 * The CTA is the meal name behind a check — not "Add to dinner". The dock is
 * already visibly about this meal (the header names it, the review sheet names
 * it), so the verb was the only word carrying no information.
 */
export function SelectionDock({
  meal,
  mealLabel,
  items,
  onAdd,
}: {
  /** Meal id, forwarded to the review sheet so it can commit too. */
  meal: string;
  /** Display label, e.g. "Dinner". */
  mealLabel: string;
  items: DiaryFood[];
  onAdd: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardVisible();

  const calories = items.reduce((sum, f) => sum + f.calories, 0);
  const empty = items.length === 0;

  const openReview = () =>
    router.push({ pathname: '/review-selection', params: { meal } });

  return (
    <ThemedView
      style={[
        styles.dock,
        {
          borderTopColor: colors.border,
          paddingBottom: (keyboardUp ? 0 : insets.bottom) + Spacing.s8,
        },
      ]}>
      {/* Reads as "there is more of this above the fold", which is what the
          review row does. Not a real drag handle: the review sheet is a native
          form sheet opened by tapping the row, and it is draggable to close. */}
      <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />

      {/* Hidden while the tray is empty. A "0 kcal · Review 0 items" line is
          the same lie as a "0" streak pill: nothing has happened yet. */}
      {empty ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Review ${items.length} ${items.length === 1 ? 'item' : 'items'}, ${calories} calories`}
          onPress={openReview}
          style={({ pressed }) => [styles.reviewRow, pressed && styles.pressed]}>
          <ThemedText type="h3" themeColor="inkStrong" tabular>
            {calories.toLocaleString()} kcal
          </ThemedText>
          <View style={styles.reviewLink}>
            <ThemedText type="sm" themeColor="textSecondary">
              Review {items.length} {items.length === 1 ? 'item' : 'items'}
            </ThemedText>
            <FontAwesomeFreeSolid name="chevron-up" size={12} color={colors.textSecondary} />
          </View>
        </Pressable>
      )}

      <View style={styles.actionRow}>
        {/* The tray opens the review sheet too — it is the thing the sheet is
            about, so tapping it going nowhere would be a dead end. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Review ${items.length} selected`}
          disabled={empty}
          onPress={openReview}
          style={({ pressed }) => pressed && styles.pressed}>
          <SelectionTray items={items} />
        </Pressable>

        <Button
          label={mealLabel}
          disabled={empty}
          onPress={onAdd}
          icon={(color) => <FontAwesomeFreeSolid name="check" size={14} color={color} />}
        />
      </View>
    </ThemedView>
  );
}

/**
 * Whether the software keyboard is up.
 *
 * `will*` on iOS so the dock's padding changes with the keyboard animation
 * rather than a frame behind it; Android only emits `did*`. Local to this file
 * until something else needs it — lift it to `src/hooks` at the second caller.
 */
function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: Spacing.s24,
    paddingTop: Spacing.s8,
    gap: Spacing.s8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.s16,
  },
  pressed: {
    opacity: 0.6,
  },
});
