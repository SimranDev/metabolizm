import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

type Props = {
  /** 0–1; values outside the range are clamped. */
  fraction: number;
  size: number;
  strokeWidth?: number;
  /** Arc color. Pass null to draw the bare track — "nothing to show" is a state. */
  color?: string | null;
  /** Dashed track, for a day that can still be planned but holds nothing. */
  dashed?: boolean;
  /** Fill behind the ring, e.g. the calendar's tinted day. */
  fill?: string | null;
  /** Centered content — a day number, usually. */
  children?: ReactNode;
};

/**
 * Circular progress on a themed track — the ring counterpart to ProgressBar,
 * drawn with react-native-svg (already a dependency, and a fraction of what a
 * Skia or charting library would add to the download for one shape).
 *
 * Static by design: no animation. The strip renders seven of these and only the
 * current day's value ever moves, so animating them would spend frames on
 * six rings that never change.
 */
export function ProgressRing({
  fraction,
  size,
  strokeWidth = 3,
  color,
  dashed = false,
  fill,
  children,
}: Props) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, fraction));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={dashed ? colors.borderStrong : colors.ringTrack}
          strokeWidth={strokeWidth}
          strokeDasharray={dashed ? '3 4' : undefined}
          fill={fill ?? 'none'}
        />
        {color !== null && color !== undefined && pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * pct} ${circumference}`}
            // Start the arc at 12 o'clock instead of 3.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children !== undefined && (
        <View style={[styles.center, StyleSheet.absoluteFill]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
