import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useDayStates } from '@/hooks/use-day-states';
import {
  addDays,
  clampDay,
  dayKey,
  formatDayOfMonth,
  formatLongDate,
  WEEKDAY_INITIALS,
  weekday,
  weekDays,
} from '@/lib/dates';
import {
  dayStatusColors,
  describeDayStatus,
  type DayState,
} from '@/lib/diary/day-status';
import { useDiary } from '@/store/diary';
import { DIARY_MAX_FUTURE_DAYS } from '@metabolizm/shared';
import { Radius, Spacing, useTheme } from '@/theme';

const RING = 34;
const CELL = 44;

/**
 * The week of the selected day, with each day's calorie progress as a ring.
 *
 * Lives on the Log tab rather than in AppHeader: the header renders above all
 * five tabs, and a selected date means nothing on Recipes or Groups — putting
 * the strip there would also redraw seven rings on every tab switch.
 *
 * Paints entirely from local diary entries via useDayStates, so a cold start
 * shows the whole week with no network request.
 */
export function DayStrip() {
  const { colors } = useTheme();
  const currentDate = useDiary((s) => s.currentDate);
  const setDate = useDiary((s) => s.setDate);

  const today = dayKey();
  const maxDay = addDays(today, DIARY_MAX_FUTURE_DAYS);
  const days = weekDays(currentDate);
  const states = useDayStates(days);

  // Paging is clamped to the plannable horizon rather than hidden past it, so
  // the arrow never becomes a control that silently does nothing.
  const goWeek = (delta: number) =>
    setDate(clampDay(addDays(currentDate, delta * 7), '2000-01-01', maxDay));

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <ArrowButton direction="back" onPress={() => goWeek(-1)} />
        <View style={styles.days}>
          {days.map((date) => (
            <DayCell
              key={date}
              date={date}
              state={states.get(date)}
              selected={date === currentDate}
              isToday={date === today}
              disabled={date > maxDay}
              onPress={() => setDate(date)}
            />
          ))}
        </View>
        <ArrowButton direction="forward" onPress={() => goWeek(1)} />
      </View>

      {currentDate !== today && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          onPress={() => setDate(today)}
          style={({ pressed }) => [
            styles.jump,
            { backgroundColor: colors.actionPrimary },
            pressed && styles.pressed,
          ]}>
          <FontAwesomeFreeSolid name="arrow-left" size={12} color={colors.onActionPrimary} />
          <ThemedText type="smBold" style={{ color: colors.onActionPrimary }}>
            Jump to today
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/**
 * One day. Memoized because a strip re-renders whenever any day's totals move,
 * and six of the seven cells are unchanged every time.
 */
const DayCell = memo(function DayCell({
  date,
  state,
  selected,
  isToday,
  disabled,
  onPress,
}: {
  date: string;
  state: DayState | undefined;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = state?.status ?? 'unknown';
  const { ring, dashed } = dayStatusColors(colors, status);
  const initial = WEEKDAY_INITIALS[weekday(date)];

  return (
    <View style={styles.dayCol}>
      <ThemedText
        type="micro"
        themeColor={isToday ? 'accentText' : 'textTertiary'}
        style={styles.initial}>
        {initial}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${formatLongDate(date)}, ${describeDayStatus(status)}`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cell,
          selected && { backgroundColor: colors.surfaceSunken },
          selected && { borderColor: colors.focusRing },
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <ProgressRing
          fraction={state?.progress ?? 0}
          size={RING}
          color={ring}
          dashed={dashed}>
          <ThemedText
            type="smBold"
            tabular
            themeColor={selected ? 'inkStrong' : 'textSecondary'}>
            {formatDayOfMonth(date)}
          </ThemedText>
        </ProgressRing>
      </Pressable>
    </View>
  );
});

function ArrowButton({
  direction,
  onPress,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Previous week' : 'Next week'}
      onPress={onPress}
      hitSlop={Spacing.s8}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
      <FontAwesomeFreeSolid
        name={direction === 'back' ? 'chevron-left' : 'chevron-right'}
        size={14}
        color={colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: Spacing.s8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.s8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.s8,
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 2,
  },
  initial: {
    textAlign: 'center',
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  arrow: {
    paddingHorizontal: Spacing.s8,
    paddingVertical: Spacing.s12,
  },
  jump: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.s8,
    paddingHorizontal: Spacing.s16,
    paddingVertical: Spacing.s8,
    borderRadius: Radius.pill,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
