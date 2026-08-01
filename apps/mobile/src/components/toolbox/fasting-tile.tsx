import { ToolTile } from '@/components/toolbox/tool-tile';
import { useElapsedHours } from '@/hooks/use-elapsed';
import {
  TICK_MS_TILE,
  fastFraction,
  formatElapsed,
  protocolLabel,
  remainingHours,
} from '@/lib/fasting';
import { useFasting } from '@/store/fasting';

/**
 * The running fast, on the Toolbox grid and Vitals.
 *
 * Ticks a minute, not a second — the tile renders hours and minutes, so a
 * per-second interval would re-render 59 times out of 60 without moving a
 * pixel, on a surface that is visible whenever either tab is open.
 *
 * With nothing running the tile is an invitation rather than a zero. "0h 00m"
 * would read as a fast that has just begun.
 */
export function FastingTile() {
  const current = useFasting((s) => s.current);
  const hours = useElapsedHours(current?.startedAt ?? null, TICK_MS_TILE);

  if (!current) {
    return (
      <ToolTile
        icon={{ ios: 'timer', android: 'timer' }}
        label="Fasting"
        href="/fasting"
        tint="accent"
        value={null}
        empty={{ title: 'Not fasting', hint: 'Tap to start a window' }}
      />
    );
  }

  const left = remainingHours(hours, current.targetHours);

  return (
    <ToolTile
      icon={{ ios: 'timer', android: 'timer' }}
      label="Fasting"
      href="/fasting"
      tint="accent"
      value={formatElapsed(hours)}
      sub={
        left === null
          ? `${protocolLabel(current)} · target hit`
          : `${formatElapsed(left)} to ${current.targetHours}h`
      }
      fraction={fastFraction(hours, current.targetHours)}
    />
  );
}
