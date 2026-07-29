import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { RulerPicker } from '@/components/ui/ruler-picker';
import { WheelPicker, type WheelItem } from '@/components/ui/wheel-picker';
import { Spacing } from '@/theme';
import { LB_PER_STONE, cmToFtIn, ftInToCm, fromKg, toKg } from '@/lib/health';
import type { HeightUnit, WeightUnit } from '@metabolizm/shared';

import { UnitToggle } from './unit-toggle';

/**
 * Canonical bounds, mirrored from the validation on the screens that host these
 * fields. The picker cannot travel outside them, so the "Next" guard on those
 * screens is now a backstop rather than the only thing standing between a user
 * and a nonsense value.
 */
const HEIGHT_MIN_CM = 80;
const HEIGHT_MAX_CM = 250;
const WEIGHT_MIN_KG = 25;
const WEIGHT_MAX_KG = 400;

/**
 * Seeds for a field the user has not touched. A ruler always reads *something*,
 * so the value it shows and the value in the store must agree from the first
 * frame — see the mount effect in each field below.
 */
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 70;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Ruler bounds for a weight unit, derived from the canonical kg bounds. */
const weightBounds = (unit: WeightUnit) =>
  unit === 'kg'
    ? { min: WEIGHT_MIN_KG, max: WEIGHT_MAX_KG }
    : // Stone runs on a pounds scale: a two-column st + lb ruler has no
      // meaningful single axis, so we scroll pounds and *read out* stone.
      { min: Math.ceil(fromKg(WEIGHT_MIN_KG, 'lb')), max: Math.floor(fromKg(WEIGHT_MAX_KG, 'lb')) };

/**
 * Weight entry with a kg / lb / st toggle. Emits canonical kilograms.
 *
 * Parents pass `key={unit}` so switching units remounts the field and re-seeds
 * from the canonical value — no effect, no cascading renders.
 */
export function WeightField({
  unit,
  onUnitChange,
  valueKg,
  defaultKg,
  onChange,
}: {
  unit: WeightUnit;
  onUnitChange: (u: WeightUnit) => void;
  valueKg?: number;
  /** Where the ruler starts when nothing is stored — goal weight seeds from the current weight. */
  defaultKg?: number;
  onChange: (kg: number | undefined) => void;
}) {
  const seed = defaultKg ?? DEFAULT_WEIGHT_KG;
  const kg = valueKg ?? seed;
  const bounds = weightBounds(unit);

  // The ruler shows a value whether or not the store holds one, so publish the
  // seed on mount. Without this the screen would display 70 kg while its Next
  // button stayed disabled on an empty store.
  useEffect(() => {
    if (valueKg == null) onChange(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll in pounds for stone; otherwise in the selected unit itself.
  const scaleUnit: WeightUnit = unit === 'st' ? 'lb' : unit;
  const displayed = round1(fromKg(kg, scaleUnit));

  return (
    <View style={styles.field}>
      <RulerPicker
        value={displayed}
        onChange={(v) => onChange(toKg(v, scaleUnit))}
        min={bounds.min}
        max={bounds.max}
        unitLabel={scaleUnit}
        format={
          unit === 'st'
            ? (lb) => {
                // Split here rather than via `kgToStLb`, which rounds pounds to
                // whole numbers and would throw away the ruler's 0.1 resolution.
                const st = Math.floor(lb / LB_PER_STONE);
                return { main: `${st} st ${(lb - st * LB_PER_STONE).toFixed(1)}`, unit: 'lb' };
              }
            : undefined
        }
        testID="weight-ruler"
      />
      <UnitToggle
        options={[
          { label: 'kg', value: 'kg' },
          { label: 'lb', value: 'lb' },
          { label: 'st', value: 'st' },
        ]}
        value={unit}
        onChange={onUnitChange}
      />
    </View>
  );
}

/**
 * Height entry with a cm / ft-in toggle. Emits canonical centimetres.
 *
 * Imperial is one wheel of composite rows ("5 ft 7 in") rather than separate
 * feet and inches columns: no invalid combination exists and there is no second
 * wheel to keep in step.
 */
export function HeightField({
  unit,
  onUnitChange,
  valueCm,
  onChange,
}: {
  unit: HeightUnit;
  onUnitChange: (u: HeightUnit) => void;
  valueCm?: number;
  onChange: (cm: number | undefined) => void;
}) {
  const cm = valueCm ?? DEFAULT_HEIGHT_CM;

  useEffect(() => {
    if (valueCm == null) onChange(DEFAULT_HEIGHT_CM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: WheelItem<number>[] = useMemo(() => {
    if (unit === 'cm') {
      return Array.from({ length: HEIGHT_MAX_CM - HEIGHT_MIN_CM + 1 }, (_, i) => {
        const v = HEIGHT_MIN_CM + i;
        return { label: `${v} cm`, value: v };
      });
    }
    // Whole inches spanning the same canonical range.
    const lo = Math.ceil(HEIGHT_MIN_CM / 2.54);
    const hi = Math.floor(HEIGHT_MAX_CM / 2.54);
    return Array.from({ length: hi - lo + 1 }, (_, i) => {
      const total = lo + i;
      return {
        label: `${Math.floor(total / 12)} ft ${total % 12} in`,
        value: ftInToCm(Math.floor(total / 12), total % 12),
      };
    });
  }, [unit]);

  // Nearest row to the canonical value — exact for cm, rounded for ft/in.
  const index = useMemo(() => {
    if (unit === 'cm') {
      return Math.min(items.length - 1, Math.max(0, Math.round(cm) - HEIGHT_MIN_CM));
    }
    const { ft, in: inch } = cmToFtIn(cm);
    const lo = Math.ceil(HEIGHT_MIN_CM / 2.54);
    return Math.min(items.length - 1, Math.max(0, ft * 12 + inch - lo));
  }, [cm, unit, items.length]);

  return (
    <View style={styles.field}>
      <WheelPicker
        items={items}
        index={index}
        onIndexChange={(i) => onChange(items[i]?.value)}
        testID="height-wheel"
      />
      <UnitToggle
        options={[
          { label: 'cm', value: 'cm' },
          { label: 'ft/in', value: 'ftin' },
        ]}
        value={unit}
        onChange={onUnitChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.s24, alignSelf: 'stretch' },
});
