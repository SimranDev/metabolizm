import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatNumber } from '@/components/ui/stat-number';
import { haptics } from '@/lib/haptics';
import {
  QUICK_ADD_ML,
  formatLoggedTime,
  formatVolume,
  goalFraction,
  volumeUnit,
  volumeValue,
} from '@/lib/water';
import { useWater } from '@/store/water';
import { Radius, Spacing, useTheme } from '@/theme';

import {
  WATER_ENTRY_MAX_ML,
  WATER_GOAL_MAX_ML,
  WATER_GOAL_MIN_ML,
  defaultWaterGoalMl,
} from '@metabolizm/shared';

/**
 * Water — the hydration log.
 *
 * Quick-add is the whole interaction: three taps covering the amounts people
 * actually drink in one go, with a custom field behind them. A form that made
 * every glass a typed number would be abandoned by the second day.
 *
 * Undo is a real delete, not a decrement, because the day is a sum of drinks
 * rather than a counter — that is why `water_entries` is append-only. Tapping a
 * logged drink removes it, and the ring follows.
 */
export default function WaterScreen() {
  const { colors } = useTheme();
  const refresh = useWater((s) => s.refresh);
  const logWater = useWater((s) => s.logWater);
  const removeEntry = useWater((s) => s.removeEntry);
  const totalMl = useWater((s) => s.totalMl);
  const goal = useWater((s) => s.goal);
  const entries = useWater((s) => s.entries);
  const days = useWater((s) => s.days);
  const streakDays = useWater((s) => s.streakDays);
  const error = useWater((s) => s.error);

  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [goalOpen, setGoalOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Water can also be logged from the add sheet; re-read on return so the ring
  // never lags a drink the user just recorded elsewhere.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const goalMl = goal?.dailyGoalMl ?? defaultWaterGoalMl(null);
  const remaining = Math.max(0, goalMl - totalMl);
  const fraction = goalFraction(totalMl, goalMl);

  const add = (ml: number) => {
    haptics.success();
    void logWater(ml);
  };

  const submitCustom = () => {
    const ml = Math.round(Number(customText.replace(',', '.')));
    if (!Number.isFinite(ml) || ml <= 0 || ml > WATER_ENTRY_MAX_ML) return;
    add(ml);
    setCustomText('');
    setCustomOpen(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader
        title="Water"
        subtitle={streakDays > 0 ? `${streakDays}-day streak` : undefined}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ProgressRing fraction={fraction} size={140} strokeWidth={10} color={colors.macroFat}>
            <View style={styles.ringInner}>
              <StatNumber value={volumeValue(totalMl)} size="md" />
              <ThemedText type="sm" themeColor="textSecondary">
                {volumeUnit(totalMl)} of {formatVolume(goalMl)}
              </ThemedText>
            </View>
          </ProgressRing>
          <ThemedText type="body" themeColor="textSecondary">
            {remaining === 0
              ? "That's your goal for today."
              : `${formatVolume(remaining)} to go today.`}
          </ThemedText>
        </View>

        {error ? (
          <ThemedText type="sm" themeColor="dangerText">
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.quickRow}>
          {QUICK_ADD_ML.map((ml) => (
            <Pressable
              key={ml}
              accessibilityRole="button"
              accessibilityLabel={`Add ${formatVolume(ml)}`}
              onPress={() => add(ml)}
              style={({ pressed }) => [
                styles.quick,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <SymbolView
                name={{ ios: 'drop.fill', android: 'water_drop' }}
                size={18}
                tintColor={colors.macroFat}
                fallback={<View />}
              />
              <ThemedText type="smBold" themeColor="inkStrong" tabular>
                {formatVolume(ml)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {customOpen ? (
          <Card style={styles.inlineForm}>
            <Input
              label="AMOUNT"
              value={customText}
              onChangeText={setCustomText}
              keyboardType="number-pad"
              numeric
              autoFocus
              placeholder="0"
              onSubmitEditing={submitCustom}
              trailing={
                <ThemedText type="sm" themeColor="textSecondary">
                  ml
                </ThemedText>
              }
            />
            <View style={styles.formActions}>
              <Button
                label="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setCustomText('');
                  setCustomOpen(false);
                }}
              />
              <Button label="Add" size="sm" onPress={submitCustom} />
            </View>
          </Card>
        ) : (
          <Button
            label="Other amount"
            variant="secondary"
            fullWidth
            onPress={() => setCustomOpen(true)}
          />
        )}

        {days.length > 0 ? (
          <Card>
            <ThemedText type="smBold" themeColor="inkStrong">
              Last {days.length} days
            </ThemedText>
            <View style={styles.bars}>
              {days.map((day) => (
                <DayBar
                  key={day.date}
                  date={day.date}
                  totalMl={day.totalMl}
                  goalMl={goalMl}
                />
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={styles.goalHead}>
            <ThemedText type="smBold" themeColor="inkStrong">
              Daily goal
            </ThemedText>
            <ThemedText type="sm" themeColor="textSecondary" tabular>
              {formatVolume(goalMl)}
            </ThemedText>
          </View>
          <ThemedText type="sm" themeColor="textTertiary">
            {goal?.isCustom
              ? 'Set by you.'
              : 'Suggested from your bodyweight — a starting point, not a prescription.'}
          </ThemedText>
          {goalOpen ? (
            <GoalEditor current={goalMl} onDone={() => setGoalOpen(false)} />
          ) : (
            <Button
              label="Change goal"
              variant="ghost"
              size="sm"
              onPress={() => setGoalOpen(true)}
            />
          )}
        </Card>

        <ThemedText type="h3" themeColor="inkStrong" style={styles.todayHead}>
          Today
        </ThemedText>

        {entries.length === 0 ? (
          <ThemedText type="body" themeColor="textSecondary">
            Nothing logged yet. Your first glass starts the day.
          </ThemedText>
        ) : (
          entries.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${formatVolume(entry.volumeMl)} logged at ${formatLoggedTime(entry.loggedAt)}`}
              onPress={() => {
                haptics.select();
                void removeEntry(entry.id);
              }}
              style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'drop.fill', android: 'water_drop' }}
                size={16}
                tintColor={colors.macroFat}
                fallback={<View />}
              />
              <ThemedText type="body" themeColor="inkStrong" tabular style={styles.entryAmount}>
                {formatVolume(entry.volumeMl)}
              </ThemedText>
              <ThemedText type="sm" themeColor="textSecondary" tabular>
                {formatLoggedTime(entry.loggedAt)}
              </ThemedText>
              <SymbolView
                name={{ ios: 'xmark', android: 'close' }}
                size={12}
                tintColor={colors.textTertiary}
                fallback={<View />}
              />
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

/**
 * One day in the trailing strip.
 *
 * A day that met the goal is filled; one that didn't is proportional. Zero
 * renders as an empty track rather than nothing at all — the day is inside the
 * window, so "nothing logged" is a real answer, not a gap.
 */
function DayBar({ date, totalMl, goalMl }: { date: string; totalMl: number; goalMl: number }) {
  const { colors } = useTheme();
  const fraction = goalFraction(totalMl, goalMl);
  // The date is a plain YYYY-MM-DD key — parsed as UTC noon so a device behind
  // UTC doesn't render every bar one weekday early.
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'narrow' });

  return (
    <View
      style={styles.barCol}
      accessibilityLabel={`${label}, ${totalMl === 0 ? 'nothing logged' : formatVolume(totalMl)}`}>
      <View style={[styles.barTrack, { backgroundColor: colors.ringTrack }]}>
        <View
          style={[
            styles.barFill,
            {
              height: `${fraction * 100}%`,
              backgroundColor: fraction >= 1 ? colors.macroFat : colors.macroFatSoft,
            },
          ]}
        />
      </View>
      <ThemedText type="micro" themeColor="textTertiary">
        {label}
      </ThemedText>
    </View>
  );
}

function GoalEditor({ current, onDone }: { current: number; onDone: () => void }) {
  const setGoal = useWater((s) => s.setGoal);
  const [text, setText] = useState(String(current));
  const [saving, setSaving] = useState(false);

  const submit = () => {
    const ml = Math.round(Number(text.replace(',', '.')));
    if (!Number.isFinite(ml) || ml < WATER_GOAL_MIN_ML || ml > WATER_GOAL_MAX_ML) return;
    setSaving(true);
    void setGoal(ml)
      .then(onDone)
      .finally(() => setSaving(false));
  };

  return (
    <View style={styles.inlineForm}>
      <Input
        label={`GOAL (${WATER_GOAL_MIN_ML}–${WATER_GOAL_MAX_ML} ml)`}
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        numeric
        autoFocus
        onSubmitEditing={submit}
        trailing={
          <ThemedText type="sm" themeColor="textSecondary">
            ml
          </ThemedText>
        }
      />
      <View style={styles.formActions}>
        <Button label="Cancel" variant="ghost" size="sm" onPress={onDone} disabled={saving} />
        <Button label={saving ? 'Saving…' : 'Save'} size="sm" onPress={submit} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.s20,
    paddingBottom: Spacing.s48,
    gap: Spacing.s16,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.s12,
    paddingVertical: Spacing.s8,
  },
  ringInner: {
    alignItems: 'center',
    gap: 2,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.s8,
  },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.s4,
    paddingVertical: Spacing.s16,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  inlineForm: {
    gap: Spacing.s12,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.s8,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.s8,
    marginTop: Spacing.s4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.s4,
  },
  barTrack: {
    width: '100%',
    height: 64,
    borderRadius: Radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: Radius.sm,
  },
  goalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  todayHead: {
    marginTop: Spacing.s8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
    paddingVertical: Spacing.s12,
  },
  entryAmount: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
