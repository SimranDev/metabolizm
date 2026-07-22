import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { MonthGrid, MonthLegend } from '@/components/log/month-grid';
import { addDays, addMonths, dayKey, formatMonth, startOfMonth } from '@/lib/dates';
import { useDiary } from '@/store/diary';
import { useSummaries } from '@/store/summaries';
import { DIARY_MAX_FUTURE_DAYS } from '@metabolizm/shared';
import { Radius, Spacing, useTheme } from '@/theme';

/**
 * The calendar. A native form sheet rather than a JS bottom-sheet library — it
 * comes with the OS drag/dismiss/detent behaviour for free and adds nothing to
 * the download.
 *
 * Presented from the root stack, above the tabs, so it can be opened from the
 * header on any tab.
 */
export default function DayPickerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const currentDate = useDiary((s) => s.currentDate);
  const setDate = useDiary((s) => s.setDate);
  const loadRange = useSummaries((s) => s.loadRange);

  const today = dayKey();
  const maxDay = addDays(today, DIARY_MAX_FUTURE_DAYS);
  const [month, setMonth] = useState(() => startOfMonth(currentDate));

  // Fill the gaps the local diary can't cover, once the sheet is actually open
  // — never on app start. Fetches the shown month plus its neighbours so
  // paging is instant; loadRange no-ops when the window is already cached.
  useEffect(() => {
    const from = addMonths(month, -1);
    const to = addDays(addMonths(month, 2), -1);
    void loadRange(from, to);
  }, [month, loadRange]);

  const select = (date: string) => {
    setDate(date);
    router.back();
  };

  const jumpToToday = () => {
    setMonth(startOfMonth(today));
    select(today);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <MonthArrow
          direction="back"
          label="Previous month"
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <ThemedText type="h3" themeColor="inkStrong">
          {formatMonth(month)}
        </ThemedText>
        <MonthArrow
          direction="forward"
          label="Next month"
          disabled={month >= startOfMonth(maxDay)}
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <MonthGrid
          month={month}
          selected={currentDate}
          today={today}
          maxDay={maxDay}
          onSelect={select}
        />
        <MonthLegend today={today} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.footerButton}>
          <Button label="Jump to today" onPress={jumpToToday} fullWidth />
        </View>
        <View style={styles.footerButton}>
          <Button label="Close" variant="secondary" onPress={() => router.back()} fullWidth />
        </View>
      </View>
    </ThemedView>
  );
}

function MonthArrow({
  direction,
  label,
  disabled = false,
  onPress,
}: {
  direction: 'back' | 'forward';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        { backgroundColor: colors.surfaceSunken },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <FontAwesomeFreeSolid
        name={direction === 'back' ? 'chevron-left' : 'chevron-right'}
        size={14}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.s20,
    paddingTop: Spacing.s16,
    paddingBottom: Spacing.s12,
  },
  body: {
    paddingHorizontal: Spacing.s16,
    paddingBottom: Spacing.s16,
    gap: Spacing.s12,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.s12,
    paddingHorizontal: Spacing.s20,
    paddingTop: Spacing.s16,
    paddingBottom: Spacing.s32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
