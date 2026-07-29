/**
 * Vertical wheel for *enumerated* values (a month, a height, a year).
 *
 * Continuous measures with sub-unit precision belong in `RulerPicker` instead —
 * the split is deliberate: a wheel makes every legal value reachable and nothing
 * illegal reachable at all, while a ruler makes fine adjustment cheap.
 *
 * A plain `ScrollView` with `snapToInterval` does the work; there is no gesture
 * to construct. The scroll position rides a shared value on the UI thread and
 * React only hears about a *change of settled row*, which is what makes the
 * haptic land exactly once per value — the same rule the weight-chart scrub
 * follows. The writes live inside a `useAnimatedScrollHandler` worklet because
 * reactCompiler rejects shared-value writes from ordinary memoized callbacks.
 */

import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { haptics } from '@/lib/haptics';
import { Spacing, useTheme } from '@/theme';

/** Row height, and the snap interval. */
export const WHEEL_ROW_H = 44;
/** Rows visible either side of the selection band. */
const HALO = 2;
/** Height of the visible window: the selected row plus its halo above and below. */
export const WHEEL_VIEWPORT_H = WHEEL_ROW_H * (HALO * 2 + 1);
/** Opacity by distance from the centre band — 0, ±1, ±2, beyond. */
const FADE = [1, 0.55, 0.3, 0.18];

export type WheelItem<T> = { label: string; value: T };

/**
 * The selection band: two rules bracketing the selected row, no box and no fill.
 *
 * Deliberately **not** `StyleSheet.hairlineWidth`. At one physical pixel in the
 * border colour the pair does not read as a band — only whichever line the eye
 * happens to catch registers, so the same symmetric band was reported as "a line
 * under the value" on one screen and "a line above it" on another. 1.5 dp in the
 * stronger border tone is still quiet, but unmistakably a pair.
 *
 * Exported so a multi-column wheel can draw **one** band across the whole row.
 * Letting each column draw its own turns the band into a row of short segments
 * with gaps between the columns, which reads as an underline under each number
 * rather than one band bracketing the selection.
 */
export function WheelBand() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={styles.bandWrap}>
      <View style={[styles.rule, { backgroundColor: colors.borderStrong }]} />
      <View style={styles.bandGap} />
      <View style={[styles.rule, { backgroundColor: colors.borderStrong }]} />
    </View>
  );
}

type Props<T> = {
  items: WheelItem<T>[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Fixed column width, for multi-column wheels. Omit to fill the parent. */
  width?: number;
  /**
   * Row size. Multi-column wheels use `statSm`, because three columns of 40pt
   * numerals do not fit a phone and truncate to an ellipsis.
   */
  textType?: 'stat' | 'statSm';
  /** Set false when a multi-column parent draws one shared band instead. */
  showBand?: boolean;
  testID?: string;
};

function Row({
  label,
  offset,
  position,
  width,
  textType,
}: {
  label: string;
  offset: SharedValue<number>;
  position: number;
  width?: number;
  textType: 'stat' | 'statSm';
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / WHEEL_ROW_H - position);
    return {
      opacity: FADE[Math.min(Math.round(distance), FADE.length - 1)],
      transform: [{ scale: 1 - Math.min(distance, 2) * 0.06 }],
    };
  });

  return (
    <Animated.View style={[styles.row, width != null && { width }, style]}>
      <ThemedText type={textType} numberOfLines={1} adjustsFontSizeToFit style={styles.rowText}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

export function WheelPicker<T>({
  items,
  index,
  onIndexChange,
  width,
  textType = 'stat',
  showBand = true,
  testID,
}: Props<T>) {
  const offset = useSharedValue(index * WHEEL_ROW_H);
  const settled = useSharedValue(index);
  const count = items.length;
  const scroller = useAnimatedRef<Animated.ScrollView>();

  /**
   * Seeding the starting row is fiddlier than it looks, because this scroller
   * is nested inside the onboarding scaffold's own vertical ScrollView.
   *
   * Three things that do *not* work, all found the hard way:
   *
   * - `contentOffset` is applied before the rows are measured, so it clamps to
   *   whatever content exists at that instant and lands short. It only appeared
   *   to work while the object was rebuilt every render — which re-applied it
   *   constantly, and was itself the cause of a fast flick running away.
   * - `scrollTo` through a plain ref is a no-op here: the ref belongs to
   *   Reanimated's animated wrapper. Reanimated's own `useAnimatedRef` plus the
   *   worklet `scrollTo` is the supported path, and is what runs below.
   * - A FlatList would seed for free via `initialScrollIndex`, but a
   *   VirtualizedList must not be nested inside a same-orientation ScrollView,
   *   and this wheel lives inside the scaffold's vertical scroller.
   *
   * Giving the content an explicit computed height (rows are a fixed size, so
   * measuring is unnecessary) makes the first layout pass final, so the guard
   * below passes immediately rather than after a cascade of partial heights.
   *
   * `seedY` is held in state, not a ref, so it can be read during render without
   * tripping the react-hooks refs rule; created once via the lazy initializer,
   * since re-seeding later would yank the list out from under a scroll.
   */
  const seeded = useRef(false);
  const [seedY] = useState(() => index * WHEEL_ROW_H);
  const contentH = count * WHEEL_ROW_H + WHEEL_VIEWPORT_H - WHEEL_ROW_H;

  const onContentSizeChange = (_w: number, h: number) => {
    if (seeded.current || h < seedY + WHEEL_VIEWPORT_H) return;
    seeded.current = true;
    runOnUI(() => {
      'worklet';
      scrollTo(scroller, 0, seedY, false);
    })();
  };

  /**
   * The visual (and the tick) track every row on the UI thread, but the value is
   * only published to React once scrolling *stops*.
   *
   * Publishing per row instead made a quick flick run away: each row crossed
   * wrote to the persisted onboarding store, which re-rendered this component
   * and re-applied a freshly-built `contentOffset` mid-fling, so the list kept
   * being shoved forward while its own momentum was still running. Settling
   * before publishing breaks that loop, and `initialOffset` above is now a
   * constant so a re-render cannot move the list either way.
   */
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.value = e.contentOffset.y;

      const next = Math.max(0, Math.min(count - 1, Math.round(e.contentOffset.y / WHEEL_ROW_H)));
      if (next !== settled.value) {
        settled.value = next;
        runOnJS(haptics.select)();
      }
    },
    // A slow drag released without momentum never fires onMomentumEnd, so both
    // are needed. Publishing the same index twice is a no-op for the caller.
    onEndDrag: () => {
      runOnJS(onIndexChange)(settled.value);
    },
    onMomentumEnd: () => {
      runOnJS(onIndexChange)(settled.value);
    },
  });

  return (
    <View style={[styles.viewport, width != null && { width }]}>
      {showBand ? <WheelBand /> : null}

      <Animated.ScrollView
        ref={scroller}
        // Required on Android for a vertical scroller inside another one.
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
        contentContainerStyle={[styles.content, { height: contentH }]}
        testID={testID}>
        {items.map((item, i) => (
          <Row
            key={`${item.label}-${i}`}
            label={item.label}
            offset={offset}
            position={i}
            width={width}
            textType={textType}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { height: WHEEL_VIEWPORT_H },
  content: { paddingVertical: WHEEL_ROW_H * HALO },
  row: {
    height: WHEEL_ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.s8,
  },
  /**
   * Pin the line box to the row so glyphs centre identically at every size.
   *
   * The `Type` scale sets a line height barely above the font size (29/28,
   * 42/40), which is fine in flowing text but rounds differently per size once
   * Android adds its font padding. Inside a fixed-height row that showed up as
   * the selected value sitting a few pixels low on the date wheel and a few
   * pixels high on the height wheel — so the same symmetric hairline pair read
   * as "line under the number" on one screen and "line above it" on the other.
   */
  rowText: { lineHeight: WHEEL_ROW_H, includeFontPadding: false },
  bandWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  bandGap: { height: WHEEL_ROW_H },
  rule: { height: 1.5 },
});
