import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptics } from '@/lib/haptics';
import { Radius, Spacing, useTheme } from '@/theme';

type Props = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Optional leading icon, platform pair like the rest of the app. */
  icon?: SymbolViewProps['name'];
};

/** A selectable row used for goal / gender / activity / plan choices. */
export function OptionCard({ label, description, selected, onPress, icon }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="surfaceSunken"
        // Selected = the 2px focus-ring treatment.
        style={[styles.card, { borderColor: selected ? colors.focusRing : 'transparent' }]}>
        {icon ? (
          <SymbolView
            name={icon}
            size={24}
            tintColor={selected ? colors.primary : colors.textSecondary}
            fallback={<View style={styles.iconSpacer} />}
          />
        ) : null}
        <View style={styles.text}>
          <ThemedText type="smBold" style={styles.label}>
            {label}
          </ThemedText>
          {description ? (
            <ThemedText type="sm" themeColor="textSecondary">
              {description}
            </ThemedText>
          ) : null}
        </View>
        {selected ? (
          <SymbolView
            name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
            size={22}
            tintColor={colors.primary}
            fallback={<View />}
          />
        ) : null}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s16,
    padding: Spacing.s16,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  iconSpacer: { width: 24, height: 24 },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 15 },
  pressed: { opacity: 0.7 },
});
