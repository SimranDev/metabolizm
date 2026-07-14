import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptics } from '@/lib/haptics';
import { Radius, Spacing, useTheme } from '@/theme';

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Small segmented control, used for unit switches (kg/lb/st, cm/ft-in). */
export function UnitToggle<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceSunken }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
            // Selected segment = accent (allowed active-state role).
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}>
            <ThemedText
              type="smBold"
              style={{ color: selected ? colors.onAccent : colors.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: Radius.md,
    alignSelf: 'center',
    gap: 2,
  },
  segment: {
    paddingHorizontal: Spacing.s16,
    paddingVertical: Spacing.s4,
    borderRadius: Radius.sm,
    minWidth: 56,
    alignItems: 'center',
  },
});
