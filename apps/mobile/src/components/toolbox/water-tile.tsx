import { ToolTile } from '@/components/toolbox/tool-tile';
import { formatVolume, goalFraction, volumeUnit, volumeValue } from '@/lib/water';
import { useTodayWater } from '@/store/water';

/**
 * Today's hydration, on both the Toolbox grid and Vitals.
 *
 * It appears on Vitals because it is a daily figure against a target — the
 * stated line between the two tabs (see CLAUDE.md). The Toolbox owns the tool
 * and its log screen; Vitals just glances at the number.
 *
 * `useTodayWater` returns null when the cache describes a different day, and
 * that null is the whole point: a total of 0 for a day the device hasn't loaded
 * would read as "you have drunk nothing", which is a claim about the user
 * rather than about the cache.
 */
export function WaterTile() {
  const today = useTodayWater();

  if (today === null) {
    return (
      <ToolTile
        icon={{ ios: 'drop.fill', android: 'water_drop' }}
        label="Water"
        href="/water"
        tint="macroFat"
        value={null}
        empty={{ title: 'Not logged yet', hint: 'Tap to add your first glass' }}
      />
    );
  }

  const remaining = Math.max(0, today.goalMl - today.totalMl);

  return (
    <ToolTile
      icon={{ ios: 'drop.fill', android: 'water_drop' }}
      label="Water"
      href="/water"
      tint="macroFat"
      value={volumeValue(today.totalMl)}
      suffix={volumeUnit(today.totalMl)}
      sub={remaining === 0 ? 'goal hit' : `${formatVolume(remaining)} to go`}
      fraction={goalFraction(today.totalMl, today.goalMl)}
    />
  );
}
