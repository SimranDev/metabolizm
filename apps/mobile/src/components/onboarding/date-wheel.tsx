/**
 * Three-column date wheel (month · day · year).
 *
 * Replaces `@expo/ui`'s inline `DateTimePicker`, which renders a platform-styled
 * control we cannot theme and which has already cost this repo one field bug
 * (F1 — the Android inline picker collapsing to zero width under a centring
 * parent, leaving age silently pinned at 25).
 *
 * The bounds are enforced *structurally*: the columns never offer a date outside
 * `min`…`max`, so an under-age date cannot be selected rather than being caught
 * by a validation message afterwards. Days are clamped to the selected month, so
 * 31 January → February lands on the 28th (or 29th), never an invalid date.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  WheelBand,
  WheelPicker,
  WHEEL_VIEWPORT_H,
  type WheelItem,
} from '@/components/ui/wheel-picker';
import { Spacing } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

type Props = {
  value: Date;
  onChange: (value: Date) => void;
  min: Date;
  max: Date;
};

export function DateWheel({ value, onChange, min, max }: Props) {
  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();

  const years = useMemo<WheelItem<number>[]>(
    () => range(min.getFullYear(), max.getFullYear()).map((y) => ({ label: String(y), value: y })),
    [min, max],
  );

  // At the boundary years the month list narrows, which is what makes an
  // out-of-range date unreachable instead of merely invalid.
  const months = useMemo<WheelItem<number>[]>(() => {
    const lo = year === min.getFullYear() ? min.getMonth() : 0;
    const hi = year === max.getFullYear() ? max.getMonth() : 11;
    return range(lo, hi).map((m) => ({ label: MONTHS[m], value: m }));
  }, [year, min, max]);

  const days = useMemo<WheelItem<number>[]>(() => {
    const lo = year === min.getFullYear() && month === min.getMonth() ? min.getDate() : 1;
    const hi =
      year === max.getFullYear() && month === max.getMonth()
        ? max.getDate()
        : daysInMonth(year, month);
    return range(lo, hi).map((d) => ({ label: String(d), value: d }));
  }, [year, month, min, max]);

  /** Rebuild a date from a partial change, clamping the day into the new month. */
  const emit = (next: { year?: number; month?: number; day?: number }) => {
    const y = next.year ?? year;
    const m = next.month ?? month;
    const d = Math.min(next.day ?? day, daysInMonth(y, m));
    onChange(new Date(y, m, d));
  };

  const indexOf = (items: WheelItem<number>[], v: number) => {
    const i = items.findIndex((item) => item.value === v);
    return i === -1 ? 0 : i;
  };

  return (
    <View style={styles.row}>
      {/* One band across all three columns. Per-column bands would render as
          three short segments with gaps between them, reading as an underline
          under each number rather than one band bracketing the selection. */}
      <WheelBand />
      <WheelPicker
        // Remount when the month list narrows at a boundary year, so the column
        // re-seeds on the clamped row instead of sitting on a stale offset.
        key={`m-${months.length}`}
        items={months}
        index={indexOf(months, month)}
        onIndexChange={(i) => emit({ month: months[i].value })}
        width={104}
        textType="statSm"
        showBand={false}
        testID="dob-month"
      />
      <WheelPicker
        key={`d-${days.length}`}
        items={days}
        index={indexOf(days, Math.min(day, days[days.length - 1]?.value ?? day))}
        onIndexChange={(i) => emit({ day: days[i].value })}
        width={72}
        textType="statSm"
        showBand={false}
        testID="dob-day"
      />
      <WheelPicker
        items={years}
        index={indexOf(years, year)}
        onIndexChange={(i) => emit({ year: years[i].value })}
        width={104}
        textType="statSm"
        showBand={false}
        testID="dob-year"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.s16,
    height: WHEEL_VIEWPORT_H,
  },
});
