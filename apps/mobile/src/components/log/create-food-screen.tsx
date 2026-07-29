import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { ApiError, createFood } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useProfile } from '@/store/profile';
import { Radius, Spacing, useTheme } from '@/theme';

import {
  DEFAULT_REGION,
  evaluateFoodFlags,
  formatGtin,
  KJ_PER_KCAL,
  type FoodFlag,
} from '@metabolizm/shared';

type EnergyUnit = 'kJ' | 'kcal';

/**
 * AU/NZ nutrition information panels are kilojoule-primary — kJ is mandatory
 * here and kcal is optional and frequently absent from the packet. So the
 * toggle defaults to kJ, and it has to stay as visually unmissable as the
 * weight sheet's kg/lb control for exactly the same reason: a unit error lands
 * inside the plausible range (a kJ figure typed as kcal is 4.184x too dense)
 * and no server-side bound can catch it.
 *
 * Defaulted from the user's region: kJ in AU/NZ, kcal elsewhere.
 */
const ENERGY_UNITS = [
  { value: 'kJ' as const, label: 'kJ' },
  { value: 'kcal' as const, label: 'kcal' },
];

const VISIBILITIES = [
  { value: 'private' as const, label: 'Just for me' },
  { value: 'public' as const, label: 'Share with everyone' },
];

type Num = string;

function num(value: Num): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Copy for a flag, phrased as a question rather than a verdict. */
function flagCopy(flag: FoodFlag, energyKcal: number): string | null {
  switch (flag.code) {
    case 'energy_unit_confusion':
      return `That looks like a kilojoule figure. ${Math.round(energyKcal)} kJ is about ${Math.round(flag.value ?? 0)} kcal — check the unit toggle.`;
    case 'atwater_mismatch':
      return flag.detail ?? 'Energy and macros disagree.';
    case 'macros_exceed_base':
      return `${flag.detail ?? ''} Per 100 g, protein + carbs + fat cannot be more than 100 g.`.trim();
    case 'implausible_energy':
      return 'That is more energy than pure fat (~900 kcal per 100 g). Is it per serving rather than per 100?';
    case 'all_zero':
      return 'Everything is zero — is that right?';
    // no_portions / suspicious_text are for the reviewer, not worth nagging
    // someone mid-typing about.
    default:
      return null;
  }
}

/**
 * Create a food. There was no create-food UI before this; the entry point is
 * the "Can't find it?" row at the bottom of search, including the no-results
 * state, which is exactly the moment someone wants it.
 *
 * The form is deliberately laid out as discrete labelled fields rather than
 * one blob, so a future "scan the label" OCR prefill can populate it without
 * reshaping anything.
 */
export function CreateFoodScreen({
  initialName,
  initialBarcode,
}: {
  initialName?: string;
  initialBarcode?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [name, setName] = useState(initialName ?? '');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  // kJ is the default in AU/NZ, where the panel is kilojoule-primary and the
  // kcal figure is often not printed at all.
  const region = useProfile((s) => s.profile?.region) ?? DEFAULT_REGION;
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>(() =>
    region === 'NZ' || region === 'AU' ? 'kJ' : 'kcal',
  );
  const [energy, setEnergy] = useState<Num>('');
  const [protein, setProtein] = useState<Num>('');
  const [carbs, setCarbs] = useState<Num>('');
  const [fat, setFat] = useState<Num>('');
  // Arriving from a scan that found nothing: the barcode is already known and
  // is the whole reason this food is worth sharing, so default to public.
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    initialBarcode ? 'public' : 'private',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stored value is ALWAYS kcal — converted once here, at the input boundary,
  // never at render and never on the server. Same rule as weight's kilograms.
  const energyKcal =
    energyUnit === 'kJ' ? num(energy) / KJ_PER_KCAL : num(energy);

  // The same pure function the API and the admin queue run, so what the user
  // is warned about here is exactly what a reviewer would see later. Catching
  // the typo now is worth far more than catching it in the queue next week.
  const flags = useMemo(
    () =>
      name.trim() === '' && energy === ''
        ? []
        : evaluateFoodFlags({
            name,
            baseUnit: 'g',
            energyKcal,
            proteinG: num(protein),
            carbsG: num(carbs),
            fatG: num(fat),
            servingLabel: servingLabel || null,
          }),
    [name, energy, energyKcal, protein, carbs, fat, servingLabel],
  );

  const warnings = flags
    .map((f) => ({ flag: f, copy: flagCopy(f, num(energy)) }))
    .filter((w): w is { flag: FoodFlag; copy: string } => w.copy !== null);

  const canSave = name.trim().length > 0 && energy !== '' && !saving;

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const food = await createFood({
        name: name.trim(),
        brand: brand.trim() || undefined,
        servingLabel: servingLabel.trim() || undefined,
        // Rounded to the column's scale so what is stored is what was shown.
        energyKcal: Math.round(energyKcal * 100) / 100,
        proteinG: num(protein),
        carbsG: num(carbs),
        fatG: num(fat),
        visibility,
        barcode: initialBarcode,
      });
      haptics.success();
      // Replace, not push: the create screen has served its purpose and
      // should not sit behind the detail in the back stack.
      router.replace({ pathname: '/food-detail', params: { foodId: food.id } });
    } catch (e) {
      // A public food carrying a barcode someone already registered is a
      // 409. That is not an error the user caused — it means the product
      // already exists, so say so rather than showing a raw failure.
      setError(
        e instanceof ApiError && e.status === 409
          ? 'A food with this barcode already exists. Search for it instead.'
          : e instanceof Error
            ? e.message
            : 'Could not save the food.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <ScreenHeader title="Create a food" dismissLabel="Cancel" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.s24 },
          ]}
          keyboardShouldPersistTaps="handled">
          <Input label="NAME" value={name} onChangeText={setName} placeholder="Weet-Bix" />
          <Input
            label="BRAND (OPTIONAL)"
            value={brand}
            onChangeText={setBrand}
            placeholder="Sanitarium"
          />
          {initialBarcode ? (
            <ThemedText type="sm" themeColor="textSecondary">
              Barcode {formatGtin(initialBarcode)} — everyone who scans this
              product will get what you enter here.
            </ThemedText>
          ) : null}
          <Input
            label="SERVING (OPTIONAL)"
            value={servingLabel}
            onChangeText={setServingLabel}
            placeholder="2 biscuits"
          />

          <View style={styles.energyBlock}>
            <ThemedText type="micro" themeColor="textTertiary">
              ENERGY PER 100 G
            </ThemedText>
            {/* Full-width and directly above the field on purpose — this is
                the control that prevents a 4.184x error. */}
            <Segmented options={ENERGY_UNITS} value={energyUnit} onChange={setEnergyUnit} />
            <Input
              value={energy}
              onChangeText={setEnergy}
              keyboardType="decimal-pad"
              numeric
              placeholder={energyUnit === 'kJ' ? '1480' : '354'}
              trailing={
                <ThemedText type="sm" themeColor="textTertiary">
                  {energyUnit}
                </ThemedText>
              }
            />
            {energyUnit === 'kJ' && energy !== '' ? (
              <ThemedText type="micro" themeColor="textTertiary">
                Stored as {Math.round(energyKcal)} kcal
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.macros}>
            <View style={styles.macroField}>
              <Input
                label="PROTEIN (G)"
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
                numeric
                placeholder="0"
              />
            </View>
            <View style={styles.macroField}>
              <Input
                label="CARBS (G)"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
                numeric
                placeholder="0"
              />
            </View>
            <View style={styles.macroField}>
              <Input
                label="FAT (G)"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
                numeric
                placeholder="0"
              />
            </View>
          </View>

          {/* Warn, never block: the user knows their packet better than the
              heuristic does. Saving stays enabled with warnings showing. */}
          {warnings.map(({ flag, copy }) => (
            <View
              key={flag.code}
              style={[
                styles.warning,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderLeftColor:
                    flag.severity === 'high' ? colors.danger : colors.border,
                },
              ]}>
              <ThemedText type="sm" themeColor="textSecondary">
                {copy}
              </ThemedText>
              {flag.code === 'energy_unit_confusion' ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    haptics.select();
                    setEnergyUnit('kcal');
                    setEnergy(String(Math.round((flag.value ?? 0) * 10) / 10));
                  }}>
                  <ThemedText type="smBold" themeColor="inkStrong">
                    Switch to kcal
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ))}

          <View style={styles.visibility}>
            <ThemedText type="micro" themeColor="textTertiary">
              WHO CAN SEE IT
            </ThemedText>
            <Segmented options={VISIBILITIES} value={visibility} onChange={setVisibility} />
            <ThemedText type="sm" themeColor="textSecondary">
              {visibility === 'public'
                ? 'Everyone can find this straight away. We check shared foods afterwards, so it may pick up a verified badge later.'
                : 'Only you can see this food.'}
            </ThemedText>
          </View>

          {error ? (
            <ThemedText type="sm" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}

          <Button label={saving ? 'Saving…' : 'Save food'} disabled={!canSave} onPress={onSave} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: Spacing.s16,
    gap: Spacing.s16,
  },
  energyBlock: { gap: Spacing.s8 },
  macros: { flexDirection: 'row', gap: Spacing.s8 },
  macroField: { flex: 1 },
  warning: {
    borderLeftWidth: 3,
    borderRadius: Radius.md,
    padding: Spacing.s12,
    gap: Spacing.s8,
  },
  visibility: { gap: Spacing.s8 },
});
