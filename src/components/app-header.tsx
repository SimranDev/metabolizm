import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from './themed-view';
import { Badge } from './ui/badge';

import { Radius, Spacing, useTheme } from '@/theme';

const ICON_SIZE = 40;

/**
 * Persistent top bar shared across every tab. Rendered above the tabs in the
 * root layout (native tabs don't provide a header).
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <ThemedView
      style={[
        styles.header,
        { paddingTop: insets.top + Spacing.s8, borderBottomColor: colors.border },
      ]}>
      <View style={styles.side}>
        <PlanIcon />
      </View>
      <View style={styles.center}>
        <DateSwitcher />
      </View>
      <View style={[styles.side, styles.sideRight]}>
        <ProfileButton />
      </View>
    </ThemedView>
  );
}

/**
 * App icon placeholder. Will switch icon / treatment by subscription tier
 * (free / pro / pro max).
 */
function PlanIcon() {
  const { colors } = useTheme();
  return (
    <ThemedView type="surfaceSunken" style={styles.iconBox}>
      <SymbolView
        name={{ ios: 'bolt.fill', android: 'bolt' }}
        size={22}
        tintColor={colors.textSecondary}
        fallback={<View />}
      />
    </ThemedView>
  );
}

/**
 * Date placeholder. Will become a calendar / day-switching control.
 */
function DateSwitcher() {
  const label = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable onPress={() => {}} style={({ pressed }) => pressed && styles.pressed}>
      <Badge
        label={label}
        trailing={(color) => (
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more' }}
            size={14}
            tintColor={color}
            fallback={<View />}
          />
        )}
      />
    </Pressable>
  );
}

/**
 * Profile button placeholder. Leads to profile settings — for now the Profile
 * tab. Will show the user's avatar image.
 */
function ProfileButton() {
  const { colors } = useTheme();
  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile settings"
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="surfaceSunken" style={styles.avatar}>
          <SymbolView
            name={{ ios: 'person.fill', android: 'person' }}
            size={22}
            tintColor={colors.textSecondary}
            fallback={<View />}
          />
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.s24,
    paddingBottom: Spacing.s8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    width: ICON_SIZE,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
