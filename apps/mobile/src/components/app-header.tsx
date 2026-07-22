import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Badge } from './ui/badge';

import { dayKey, formatMediumDate, formatWeekday } from '@/lib/dates';
import { combineStreak, localStreak, useDiary } from '@/store/diary';
import { refreshStreak, useSummaries } from '@/store/summaries';
import { Spacing, useTheme } from '@/theme';

const ICON_SIZE = 40;

/**
 * Persistent top bar shared across every tab. Rendered above the tabs in the
 * root layout (native tabs don't provide a header).
 *
 * The week strip deliberately does NOT live here — it belongs to the Log tab,
 * where a selected day means something. What stays global is the streak, the
 * day being viewed, and the way into the calendar.
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
        <StreakPill />
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
 * Consecutive days with food logged.
 *
 * Derived from local entries, so it is correct and instant with no request. The
 * server is asked only when the local run reaches the edge of the retained
 * window and the real streak is therefore longer than the device can see —
 * which for most accounts is never.
 */
function StreakPill() {
  const entriesByDate = useDiary((s) => s.entriesByDate);
  const serverStreak = useSummaries((s) => s.streak);

  const local = localStreak(entriesByDate, dayKey());
  const streak = combineStreak(local, serverStreak);

  useEffect(() => {
    if (local.truncated) refreshStreak();
  }, [local.truncated]);

  // Nothing to celebrate yet, and a "0" pill would read as a scolding.
  if (streak === 0) return <View style={styles.iconBox} />;

  return (
    <Badge
      label={String(streak)}
      variant="accent"
      icon={(color) => <FontAwesomeFreeSolid name="fire" size={13} color={color} />}
    />
  );
}

/**
 * The day the app is showing, and the way into the calendar.
 *
 * Shows "Today" for the current day and the weekday name otherwise, with the
 * full date underneath — a bare "Wed, Jul 22" gives no clue you have navigated
 * away from today, which is the one thing this control has to make obvious.
 */
function DateSwitcher() {
  const { colors } = useTheme();
  const router = useRouter();
  const currentDate = useDiary((s) => s.currentDate);
  const isToday = currentDate === dayKey();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Showing ${formatMediumDate(currentDate)}. Open calendar`}
      onPress={() => router.push('/day-picker')}
      style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
      <View style={styles.dateRow}>
        <ThemedText type="h3" themeColor="inkStrong">
          {isToday ? 'Today' : formatWeekday(currentDate)}
        </ThemedText>
        <FontAwesomeFreeSolid name="chevron-down" size={12} color={colors.inkStrong} />
      </View>
      <ThemedText type="micro" themeColor="textSecondary" tabular>
        {formatMediumDate(currentDate)}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Profile button placeholder. Leads to profile settings — for now the Profile
 * tab. Will show the user's avatar image, and is where the subscription tier
 * treatment lands now that the plan icon has given up the left slot.
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
    // Wide enough for a three-digit streak without shifting the centred date.
    minWidth: 56,
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
  },
  dateButton: {
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
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
