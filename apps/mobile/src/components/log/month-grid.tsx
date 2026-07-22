import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useDayStates } from '@/hooks/use-day-states';
import {
  formatDayOfMonth,
  formatLongDate,
  monthGrid,
  WEEKDAY_INITIALS,
} from '@/lib/dates';
import {
  DAY_STATUS_LEGEND,
  dayStatusColors,
  describeDayStatus,
  type DayState,
} from '@/lib/diary/day-status';
import { Radius, Spacing, useTheme } from '@/theme';

/**
 * A month of days as tinted cells.
 *
 * Tinted fills rather than rings on purpose: at 42 cells the ring's precision
 * is unreadable anyway, a filled cell carries the same on-target/over/light
 * status at a glance, and it costs 42 plain Views instead of 84 SVG nodes.
 */
export function MonthGrid({
  month,
  selected,
  today,
  maxDay,
  onSelect,
}: {
  /** Any day within the month to render. */
  month: string;
  selected: string;
  today: string;
  /** Latest plannable day; anything beyond is inert. */
  maxDay: string;
  onSelect: (date: string) => void;
}) {
  const cells = monthGrid(month);
  const dates = cells.filter((c): c is string => c !== null);
  const states = useDayStates(dates);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={index} style={styles.cellSlot}>
            <ThemedText type="micro" themeColor="textTertiary" style={styles.center}>
              {initial}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) =>
          date === null ? (
            <View key={`blank-${index}`} style={styles.cellSlot} />
          ) : (
            <View key={date} style={styles.cellSlot}>
              <DayCell
                date={date}
                state={states.get(date)}
                selected={date === selected}
                isToday={date === today}
                disabled={date > maxDay}
                onPress={() => onSelect(date)}
              />
            </View>
          ),
        )}
      </View>
    </View>
  );
}

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
  const { ring, fill, dashed } = dayStatusColors(colors, status);

  // Today wins the border, then the selection: the two coincide most of the
  // time, and when they don't "where am I" matters more than "what is today".
  const borderColor = selected
    ? colors.focusRing
    : isToday
      ? colors.accent
      : dashed
        ? colors.borderStrong
        : (ring ?? 'transparent');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${formatLongDate(date)}, ${describeDayStatus(status)}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: fill ?? 'transparent',
          borderColor,
          borderStyle: dashed && !selected && !isToday ? 'dashed' : 'solid',
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <ThemedText
        type="smBold"
        tabular
        themeColor={
          status === 'over'
            ? 'dangerText'
            : status === 'on-target'
              ? 'successText'
              : status === 'unknown'
                ? 'textTertiary'
                : 'text'
        }>
        {formatDayOfMonth(date)}
      </ThemedText>
    </Pressable>
  );
});

/** The key to the cell colours, mirroring what the grid actually renders. */
export function MonthLegend({ today }: { today: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.legend, { borderTopColor: colors.border }]}>
      {DAY_STATUS_LEGEND.map(({ status, label }) => {
        const { ring, fill, dashed } = dayStatusColors(colors, status);
        return (
          <View key={status} style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: fill ?? 'transparent',
                  borderColor: dashed ? colors.borderStrong : (ring ?? colors.border),
                  borderStyle: dashed ? 'dashed' : 'solid',
                },
              ]}
            />
            <ThemedText type="micro" themeColor="textSecondary">
              {label}
            </ThemedText>
          </View>
        );
      })}
      <View style={styles.legendItem}>
        <View
          style={[styles.swatch, { borderColor: colors.accent, backgroundColor: 'transparent' }]}
        />
        <ThemedText type="micro" themeColor="textSecondary">
          Today ({formatDayOfMonth(today)})
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.s4,
  },
  headerRow: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Fixed sevenths so the grid never reflows between a 4- and 6-row month.
  cellSlot: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  center: {
    textAlign: 'center',
  },
  cell: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s12,
    paddingTop: Spacing.s12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
