import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { macroSoftColor, macroTextColor, Radius, Spacing, useTheme } from '@/theme';

import type { DiaryFood } from '@metabolizm/shared';

/**
 * Slots the tray holds. Fixed rather than grown to fit, which is what makes it
 * read as a physical object: the empty slots are the tray, not a gap.
 */
const CAPACITY = 4;

const SLOT = 30;

/**
 * The selected foods, sitting in a tray.
 *
 * Built as a rim around a recessed floor around raised slots, because a flat
 * outlined box does not read as something you can put food *in*. The depth is
 * all borders and fill steps — no shadow, which draws nothing over dark
 * anyway (see `Elevation`), and no image, which would cost download size for
 * one widget.
 *
 * **The slots carry the food's initial over its dominant-macro tint, not a
 * picture of the food.** The catalog has no per-food imagery — `DiaryFood`
 * carries a name, numbers, and an `accent`, and nothing else — so a literal
 * food icon here would have to be invented per row. The initial is the most
 * identifying thing that is actually true, and the tint is the same
 * dominant-macro cue the list row's dot already shows.
 */
export function SelectionTray({ items }: { items: DiaryFood[] }) {
  const { colors } = useTheme();

  // Past capacity the last slot becomes a counter, so the tray never grows and
  // never silently hides the fact that there is more in it.
  const overflow = items.length > CAPACITY;
  const shown = overflow ? items.slice(0, CAPACITY - 1) : items;
  const empties = Math.max(0, CAPACITY - shown.length - (overflow ? 1 : 0));

  return (
    <View
      accessibilityLabel={
        items.length === 0
          ? 'Tray, empty'
          : `Tray, ${items.length} ${items.length === 1 ? 'item' : 'items'}`
      }
      style={[
        styles.rim,
        {
          backgroundColor: colors.surfaceSunken,
          borderColor: colors.borderStrong,
          // Thicker at the bottom: the tray's front edge, the one face you
          // would actually see from above.
          borderBottomColor: colors.borderStrong,
        },
      ]}>
      <View style={[styles.floor, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        {shown.map((item) => (
          <View
            key={item.foodId}
            style={[
              styles.slot,
              {
                backgroundColor: macroSoftColor(colors, item.accent),
                borderColor: macroTextColor(colors, item.accent),
              },
            ]}>
            <ThemedText type="smBold" style={{ color: macroTextColor(colors, item.accent) }}>
              {initialOf(item.name)}
            </ThemedText>
          </View>
        ))}

        {overflow ? (
          <View style={[styles.slot, { backgroundColor: colors.surfaceSunken, borderColor: colors.borderStrong }]}>
            <ThemedText type="smBold" themeColor="textSecondary" tabular>
              +{items.length - (CAPACITY - 1)}
            </ThemedText>
          </View>
        ) : null}

        {Array.from({ length: empties }, (_, i) => (
          <View
            key={`empty-${i}`}
            style={[styles.slot, styles.emptySlot, { borderColor: colors.border }]}
          />
        ))}
      </View>
    </View>
  );
}

/** First letter of the food's name, or "?" for a name that is all punctuation. */
function initialOf(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || '?';
}

const styles = StyleSheet.create({
  rim: {
    borderRadius: Radius.md,
    // Bottom corners rounder than the top, and a deeper bottom rail — a tray
    // seen slightly from above.
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 2,
    paddingHorizontal: Spacing.s4,
    paddingTop: Spacing.s4,
    paddingBottom: Spacing.s8,
    alignSelf: 'flex-start',
  },
  floor: {
    flexDirection: 'row',
    gap: Spacing.s4,
    padding: Spacing.s4,
    borderRadius: Radius.sm,
    // The line where the floor meets the rim, standing in for an inner shadow.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  slot: {
    width: SLOT,
    height: SLOT,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
});
