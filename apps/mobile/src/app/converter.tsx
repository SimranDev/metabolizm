import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { G_PER_FL_OZ, G_PER_OZ } from '@/lib/food';
import { CM_PER_IN, IN_PER_FT, KG_PER_LB, KG_PER_STONE, cmToFtIn } from '@/lib/health';
import { Spacing } from '@/theme';

/**
 * Unit converter.
 *
 * Not filler. This app's users are in NZ/AU and most of its catalog is USDA, so
 * the mismatches it converts are the same ones the codebase already guards
 * against elsewhere: kJ typed into a kcal field is 4.184× too dense and lands
 * inside the plausible range (`energy_unit_confusion`), and a pound value
 * entered as kilograms passes the server's 20–500 kg bound untouched.
 *
 * Every factor here is imported, never retyped. `lib/health/units` and
 * `lib/food/units` are the single source for each one — a converter carrying
 * its own copy of 0.45359237 is exactly how the two drift.
 *
 * Energy has no helper to import because only one direction is ever stored:
 * `create-food` converts kJ → kcal once at the input boundary and keeps kcal.
 * The divisor is named here for the same reason.
 */

/** kJ in one kcal. The thermochemical calorie, matching the create-food form. */
const KJ_PER_KCAL = 4.184;

/** The metric cup used in AU/NZ recipes. The US cup is 236.6 ml. */
const ML_PER_CUP = 250;

const MODES = [
  { value: 'weight', label: 'Weight' },
  { value: 'height', label: 'Height' },
  { value: 'energy', label: 'Energy' },
  { value: 'amount', label: 'Amount' },
] as const;

type Mode = (typeof MODES)[number]['value'];

export default function ConverterScreen() {
  const [mode, setMode] = useState<Mode>('weight');

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Unit converter" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Segmented options={MODES} value={mode} onChange={setMode} />

        {mode === 'weight' ? <WeightConverter /> : null}
        {mode === 'height' ? <HeightConverter /> : null}
        {mode === 'energy' ? <EnergyConverter /> : null}
        {mode === 'amount' ? <AmountConverter /> : null}
      </ScrollView>
    </ThemedView>
  );
}

/**
 * One editable field plus its conversions, driven by a single source value.
 *
 * Only the focused field is a text input; the rest are computed readouts. Two
 * live-bound inputs round-trip through each other on every keystroke, so
 * "70.0" becomes "69.9" while the user is still typing in the other box.
 */
function ConverterCard({
  label,
  unit,
  value,
  onChange,
  results,
  note,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  results: { label: string; value: string }[];
  note?: string;
}) {
  return (
    <Card style={styles.card}>
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        numeric
        placeholder="0"
        trailing={
          <ThemedText type="sm" themeColor="textSecondary">
            {unit}
          </ThemedText>
        }
      />

      <View style={styles.results}>
        {results.map((result) => (
          <View key={result.label} style={styles.row}>
            <ThemedText type="sm" themeColor="textSecondary" style={styles.rowLabel}>
              {result.label}
            </ThemedText>
            <ThemedText type="smBold" themeColor="inkStrong" tabular numberOfLines={1}>
              {result.value}
            </ThemedText>
          </View>
        ))}
      </View>

      {note ? (
        <ThemedText type="sm" themeColor="textTertiary">
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** Parsed input, or null for empty/garbage — which renders `—`, never 0. */
function parse(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const show = (n: number | null, decimals = 1): string =>
  n === null ? '—' : n.toFixed(decimals);

function WeightConverter() {
  const [kgText, setKgText] = useState('70');
  const [lbText, setLbText] = useState('154');
  const kg = parse(kgText);
  const lb = parse(lbText);

  return (
    <>
      <ConverterCard
        label="KILOGRAMS"
        unit="kg"
        value={kgText}
        onChange={setKgText}
        results={[
          { label: 'Pounds', value: `${show(kg === null ? null : kg / KG_PER_LB)} lb` },
          {
            label: 'Stone',
            value:
              kg === null
                ? '—'
                : `${Math.floor(kg / KG_PER_STONE)} st ${show(
                    (kg % KG_PER_STONE) / KG_PER_LB,
                  )} lb`,
          },
        ]}
      />
      <ConverterCard
        label="POUNDS"
        unit="lb"
        value={lbText}
        onChange={setLbText}
        results={[{ label: 'Kilograms', value: `${show(lb === null ? null : lb * KG_PER_LB)} kg` }]}
        note="Everything the app stores is kilograms — a pound figure entered as kg sits well inside the accepted range."
      />
    </>
  );
}

function HeightConverter() {
  const [cmText, setCmText] = useState('180');
  const [ftText, setFtText] = useState('5');
  const [inText, setInText] = useState('11');
  const cm = parse(cmText);
  const ft = parse(ftText);
  const inches = parse(inText);
  const ftIn = cm === null ? null : cmToFtIn(cm);

  return (
    <>
      <ConverterCard
        label="CENTIMETRES"
        unit="cm"
        value={cmText}
        onChange={setCmText}
        results={[
          { label: 'Feet & inches', value: ftIn === null ? '—' : `${ftIn.ft}′ ${ftIn.in}″` },
          { label: 'Inches', value: `${show(cm === null ? null : cm / CM_PER_IN)}″` },
        ]}
      />
      <Card style={styles.card}>
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <Input
              label="FEET"
              value={ftText}
              onChangeText={setFtText}
              keyboardType="number-pad"
              numeric
              placeholder="0"
            />
          </View>
          <View style={styles.pairItem}>
            <Input
              label="INCHES"
              value={inText}
              onChangeText={setInText}
              keyboardType="decimal-pad"
              numeric
              placeholder="0"
            />
          </View>
        </View>
        <View style={styles.results}>
          <View style={styles.row}>
            <ThemedText type="sm" themeColor="textSecondary" style={styles.rowLabel}>
              Centimetres
            </ThemedText>
            <ThemedText type="smBold" themeColor="inkStrong" tabular>
              {ft === null || inches === null
                ? '—'
                : `${((ft * IN_PER_FT + inches) * CM_PER_IN).toFixed(1)} cm`}
            </ThemedText>
          </View>
        </View>
      </Card>
    </>
  );
}

function EnergyConverter() {
  const [kjText, setKjText] = useState('1000');
  const [kcalText, setKcalText] = useState('239');
  const kj = parse(kjText);
  const kcal = parse(kcalText);

  return (
    <>
      <ConverterCard
        label="KILOJOULES"
        unit="kJ"
        value={kjText}
        onChange={setKjText}
        results={[
          { label: 'Calories', value: `${show(kj === null ? null : kj / KJ_PER_KCAL, 0)} kcal` },
        ]}
        note="AU/NZ panels lead with kilojoules and often omit calories entirely."
      />
      <ConverterCard
        label="CALORIES"
        unit="kcal"
        value={kcalText}
        onChange={setKcalText}
        results={[
          { label: 'Kilojoules', value: `${show(kcal === null ? null : kcal * KJ_PER_KCAL, 0)} kJ` },
        ]}
        note="Read a kJ figure as kcal and the food lands 4.184× too energy-dense — still a plausible-looking number, which is what makes it worth checking."
      />
    </>
  );
}

function AmountConverter() {
  const [gText, setGText] = useState('100');
  const [mlText, setMlText] = useState('250');
  const grams = parse(gText);
  const ml = parse(mlText);

  return (
    <>
      <ConverterCard
        label="GRAMS"
        unit="g"
        value={gText}
        onChange={setGText}
        results={[{ label: 'Ounces', value: `${show(grams === null ? null : grams / G_PER_OZ)} oz` }]}
      />
      <ConverterCard
        label="MILLILITRES"
        unit="ml"
        value={mlText}
        onChange={setMlText}
        results={[
          { label: 'Fluid ounces', value: `${show(ml === null ? null : ml / G_PER_FL_OZ)} fl oz` },
          // The 250 ml metric cup, which is the AU/NZ one.
          { label: 'Cups (250 ml)', value: show(ml === null ? null : ml / ML_PER_CUP, 2) },
        ]}
        note="Fluid ounces here are the US measure (29.57 ml), matching the catalog's own portion math."
      />
    </>
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
  card: {
    gap: Spacing.s16,
  },
  results: {
    gap: Spacing.s8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.s12,
  },
  rowLabel: {
    flex: 1,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.s12,
  },
  pairItem: {
    flex: 1,
  },
});
