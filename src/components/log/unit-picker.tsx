import { FontAwesomeFreeSolid } from "@react-native-vector-icons/fontawesome-free-solid";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { FoodUnit } from "@/lib/food";
import { haptics } from "@/lib/haptics";

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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const select = (unit: FoodUnit) => {
    haptics.select();
    onChange(unit);
    setOpen(false);
  };

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary" style={styles.caps}>
        UNIT
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Unit: ${value.label}. Change unit`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <ThemedText style={styles.value} numberOfLines={1}>
          {value.label}
        </ThemedText>
        <FontAwesomeFreeSolid name="chevron-down" size={14} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
            ]}
            onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.sheetTitle}>
              SELECT UNIT
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
                    <ThemedText themeColor={selected ? "tint" : "text"}>{unit.label}</ThemedText>
                    {selected && <FontAwesomeFreeSolid name="check" size={16} color={theme.tint} />}
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
  caps: {
    letterSpacing: 1.2,
    marginBottom: Spacing.one,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    height: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
  },
  value: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.three,
  },
  sheetTitle: {
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  list: {
    maxHeight: 320,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
