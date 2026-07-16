import { FontAwesomeFreeSolid } from "@react-native-vector-icons/fontawesome-free-solid";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import type { FoodUnit } from "@metabolizm/shared";
import { haptics } from "@/lib/haptics";
import { Fonts, Radius, Spacing, useTheme } from "@/theme";

type Props = {
  units: FoodUnit[];
  value: FoodUnit;
  onChange: (unit: FoodUnit) => void;
};

/**
 * Unit dropdown for the nutrition-info screen: a field showing the current unit
 * that opens a bottom-sheet list of the food's available units. Uses a plain RN
 * `Modal` (no extra dependency) to keep app size down.
 */
export function UnitPicker({ units, value, onChange }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const select = (unit: FoodUnit) => {
    haptics.select();
    onChange(unit);
    setOpen(false);
  };

  return (
    <>
      <ThemedText type="micro" themeColor="textTertiary" style={styles.label}>
        Unit
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Unit: ${value.label}. Change unit`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: colors.surfaceSunken },
          pressed && styles.pressed,
        ]}>
        <ThemedText style={styles.value} numberOfLines={1}>
          {value.label}
        </ThemedText>
        <FontAwesomeFreeSolid name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.s16 },
            ]}
            onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            <ThemedText type="micro" themeColor="textSecondary" style={styles.sheetTitle}>
              Select unit
            </ThemedText>
            <ScrollView style={styles.list} bounces={false}>
              {units.map((unit, index) => {
                const selected = unit.label === value.label && unit.grams === value.grams;
                return (
                  <Pressable
                    key={`${unit.label}-${index}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => select(unit)}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                    <ThemedText themeColor={selected ? "primary" : "text"}>{unit.label}</ThemedText>
                    {selected && <FontAwesomeFreeSolid name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.s8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.s8,
    height: 48,
    paddingHorizontal: Spacing.s16,
    borderRadius: Radius.md,
  },
  value: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 22,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.s24,
    paddingTop: Spacing.s8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.s16,
  },
  sheetTitle: {
    marginBottom: Spacing.s8,
  },
  list: {
    maxHeight: 320,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.s16,
  },
  pressed: {
    opacity: 0.6,
  },
});
