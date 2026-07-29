/**
 * Horizontal ruler for *continuous* measures (a bodyweight), resolving to a
 * fraction of a unit. Enumerated values belong in `WheelPicker` instead.
 *
 * Deliberately slower per pixel than a keypad is per tap: this is the control
 * standing between a user and a mistyped bodyweight, so fine adjustment is
 * cheap and a wild value costs a long, obviously-wrong scroll.
 *
 * One `FlatList` cell per whole unit with `getItemLayout`, so a 25–400 kg domain
 * virtualises to ~375 cells rather than rendering 3 750 individual ticks. Scroll
 * position rides a shared value written inside a `useAnimatedScrollHandler`
 * worklet — reactCompiler rejects those writes from ordinary callbacks.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { haptics } from '@/lib/haptics';
import { Radius, Spacing, useTheme } from '@/theme';

/**
 * Density-independent pixels per minor tick; ten minor ticks make one labelled
 * unit. 9 dp puts roughly five labelled units on a phone — enough context to see
 * where you are, tight enough that a long correction is not a marathon.
 */
const MINOR_W = 9;
const TICKS_PER_UNIT = 10;
const CELL_W = MINOR_W * TICKS_PER_UNIT;
const TRACK_H = 64;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<number>);

type Props = {
  /** Current value, in whatever unit `unitLabel` names. */
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Decimals shown in the readout. Ticks always resolve to 1/10 of a unit. */
  precision?: number;
  unitLabel: string;
  /** Overrides the default readout — used by stone, which reads "12 st 5.0 lb". */
  format?: (value: number) => { main: string; unit: string };
  testID?: string;
};

function Cell({ unit, offset, index }: { unit: number; offset: SharedValue<number>; index: number }) {
  const { colors } = useTheme();

  // Fade toward both edges of the viewport, so the ruler reads as a window onto
  // a longer scale rather than a component with hard ends.
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / CELL_W - index);
    return { opacity: Math.min(1, Math.max(0.12, 1 - distance * 0.28)) };
  });

  return (
    <Animated.View style={[styles.cell, style]}>
      <ThemedText type="micro" themeColor="textTertiary" style={styles.cellLabel}>
        {unit}
      </ThemedText>
      <View style={styles.ticks}>
        {Array.from({ length: TICKS_PER_UNIT }, (_, t) => (
          <View
            key={t}
            style={[
              styles.tick,
              {
                height: t === 0 ? 26 : 14,
                backgroundColor: t === 0 ? colors.textTertiary : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export function RulerPicker({
  value,
  onChange,
  min,
  max,
  precision = 1,
  unitLabel,
  format,
  testID,
}: Props) {
  const { colors } = useTheme();
  const [viewportW, setViewportW] = useState(0);
  const base = Math.floor(min);

  const offset = useSharedValue((value - base) * CELL_W);
  // The value under the needle, and the last whole unit crossed. Shared values,
  // not state: the handler runs on the UI thread every frame.
  const settled = useSharedValue(value);
  const lastUnit = useSharedValue(Math.round(value));
  // What the readout shows. Local, so a drag re-renders this component only.
  const [display, setDisplay] = useState(value);

  const list = useRef<FlatList<number>>(null);
  const seeded = useRef(value);

  const units = useMemo(
    () => Array.from({ length: Math.ceil(max) - base + 1 }, (_, i) => base + i),
    [base, max],
  );

  // Seed the scroll position once the viewport width is known — the content
  // inset depends on it, so this cannot run before layout.
  useEffect(() => {
    if (viewportW === 0) return;
    list.current?.scrollToOffset({ offset: (seeded.current - base) * CELL_W, animated: false });
  }, [viewportW, base]);

  // Adopt a value the caller changed itself (a seed, or a clamp on save). After
  // our own settle this is a no-op, since the caller echoes back what we sent.
  // Adjusting state during render is React's documented alternative to a
  // syncing effect: it re-runs the component before anything is painted, with
  // no extra commit.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDisplay(value);
  }

  /**
   * The readout follows the scroll live, but only local state moves with it —
   * the caller hears the value once scrolling stops.
   *
   * Publishing every 0.1 wrote to the persisted onboarding store on each tick,
   * re-rendering the whole screen mid-drag. Keeping that churn inside this
   * component makes a fast flick cost one store write instead of a hundred.
   */
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const x = e.contentOffset.x;
      offset.value = x;

      const raw = base + x / CELL_W;
      const stepped = Math.min(max, Math.max(min, Math.round(raw * TICKS_PER_UNIT) / TICKS_PER_UNIT));
      if (stepped === settled.value) return;
      settled.value = stepped;
      runOnJS(setDisplay)(stepped);

      // A tick every 0.1 would buzz continuously; one per whole unit reads as
      // progress without becoming noise.
      const whole = Math.round(stepped);
      if (whole !== lastUnit.value) {
        lastUnit.value = whole;
        runOnJS(haptics.select)();
      }
    },
    // A slow drag released without momentum never fires onMomentumEnd.
    onEndDrag: () => {
      runOnJS(onChange)(settled.value);
    },
    onMomentumEnd: () => {
      runOnJS(onChange)(settled.value);
    },
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.readout}>
        <ThemedText type="statXl" tabular>
          {format ? format(display).main : display.toFixed(precision)}
        </ThemedText>
        <ThemedText type="statSm" themeColor="textSecondary">
          {format ? format(display).unit : unitLabel}
        </ThemedText>
      </View>

      <View style={styles.track} onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}>
        {viewportW > 0 ? (
          <AnimatedFlatList
            ref={list}
            data={units}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={MINOR_W}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onScroll}
            keyExtractor={(u) => String(u)}
            getItemLayout={(_, index) => ({ length: CELL_W, offset: CELL_W * index, index })}
            contentContainerStyle={{ paddingHorizontal: viewportW / 2 }}
            renderItem={({ item, index }) => <Cell unit={item} offset={offset} index={index} />}
            testID={testID}
          />
        ) : null}
        {/* The needle marks the live value — an allowed accent role. */}
        <View pointerEvents="none" style={[styles.needle, { backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: Spacing.s12 },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.s8,
  },
  track: { height: TRACK_H, justifyContent: 'center' },
  cell: { width: CELL_W, height: TRACK_H, justifyContent: 'flex-end' },
  cellLabel: { position: 'absolute', top: 0, left: -12, width: 24, textAlign: 'center' },
  ticks: { flexDirection: 'row', alignItems: 'flex-end', height: 26 },
  tick: { width: 1, marginRight: MINOR_W - 1 },
  needle: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 38,
    bottom: 0,
    borderRadius: Radius.sm,
  },
});
