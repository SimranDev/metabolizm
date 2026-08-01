import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton } from '@/components/ui/icon-button';
import { formatDayOfMonth, formatLongDate, formatMonthShort } from '@/lib/dates';
import { formatVolume } from '@/lib/water';
import { formatWeight } from '@/lib/weight';
import { useDiary } from '@/store/diary';
import { useTodayWater } from '@/store/water';
import { useWeight } from '@/store/weight';
import { Radius, Spacing, useTheme } from '@/theme';

/**
 * A per-platform glyph pair — SF Symbol on iOS, Material `md` symbol on
 * Android. Narrowed out of `SymbolViewProps` rather than importing
 * `sf-symbols-typescript` directly, which is expo-symbols' transitive
 * dependency and not resolvable from this package under isolated linking.
 */
type Icon = Exclude<SymbolViewProps['name'], string>;

/**
 * Width of the date chip and the close button. One number for both, because
 * they flank a centred title — a mismatch pushes "Add" off centre by half the
 * difference.
 */
const CONTROL_SIZE = 36;

/**
 * Optical lift for the two flanking controls. The chip is the tallest thing in
 * the header, so it sets the row height and centring leaves it and the close
 * button sitting low against the title's cap height. A transform rather than
 * margin: this is a visual correction, and it must not change the row's
 * measured height — the sheet's `fitToContents` detent is measuring it.
 */
const CONTROL_LIFT = 4;

/**
 * Which meal a food logged from this sheet lands in.
 *
 * The Log tab's per-meal "+" buttons carry that context in the route, so they
 * always know. This sheet is opened from the tab bar, which knows only the day
 * — so it has to choose one, and breakfast is the placeholder. The real answer
 * is either picking by time of day or letting the add-food screen's header
 * change the meal (that control is already stubbed there, waiting on a picker).
 */
const DEFAULT_MEAL = 'breakfast';

/**
 * The add sheet, opened by the raised "+" in the middle of the tab bar
 * ([../components/add-button.tsx]).
 *
 * A native `formSheet` for the same reason the calendar is one: the OS owns
 * the drag, detents and dismiss, so no bottom-sheet library enters the bundle.
 * Its detent is `fitToContents` rather than a fraction — the option list is a
 * fixed height, so a fraction would either clip it on a small phone or leave
 * dead space on a large one, and it grows correctly under large text settings.
 * Nothing scrolls, which is what lets the OS measure it.
 *
 * The drag handle is drawn here rather than via `sheetGrabberVisible`, which
 * is **iOS only** — on Android that option is silently ignored and the sheet
 * shows no affordance at all. One handle in themed pixels beats a grabber on
 * half the platforms.
 *
 * Two tiers, because the four ways of capturing food are one decision and
 * everything else is a different kind of entry: a tap grid for the capture
 * methods, then a list for the standalone logs.
 *
 * Search, Water and Weight have destinations. The rest are inert pending the
 * discussion of what each one should do, and say so in their trailing hint
 * rather than showing a plausible number.
 */
export default function AddEntryScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.handleRow}>
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
      </View>

      <View style={styles.header}>
        <DateChip />
        <ThemedText type="h2" style={styles.title}>
          Add
        </ThemedText>
        {/* Wrapped because `IconButton` takes no style — the lift belongs to
            the header's layout, not to the button's own API. */}
        <View style={styles.lifted}>
          <IconButton
            accessibilityLabel="Close"
            variant="sunken"
            size={CONTROL_SIZE}
            onPress={() => router.back()}
            icon={(color) => (
              <SymbolView
                name={{ ios: 'xmark', android: 'close' }}
                size={16}
                tintColor={color}
                fallback={<View />}
              />
            )}
          />
        </View>
      </View>

      <View style={styles.body}>
        {/* The four capture methods sit on `surfaceSunken` — a step off the
            sheet's `surface` in both schemes — so the strip reads as one
            control group rather than four more list rows. */}
        <View
          style={[
            styles.grid,
            { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
          ]}>
          <CaptureCell
            label="Search"
            icon={{ ios: 'magnifyingglass', android: 'search' }}
            // `replace`, not `push`: the sheet must not stay in the stack under
            // the add-food modal, or closing that modal would drop the user
            // back onto the sheet they had already moved on from. The day
            // needs no param — add-food writes to the diary store's
            // `currentDate`, which is the day the chip above is showing.
            onPress={() =>
              router.replace({
                pathname: '/add-food',
                params: { meal: DEFAULT_MEAL, method: 'search' },
              })
            }
            first
          />
          <CaptureCell label="Barcode" icon={{ ios: 'barcode', android: 'barcode' }} />
          <CaptureCell label="Photo" icon={{ ios: 'camera', android: 'photo_camera' }} />
          <CaptureCell label="Dictate" icon={{ ios: 'mic', android: 'mic' }} />
        </View>

        <View>
          <EntryRow
            label="Quick add"
            hint="kcal & macros"
            icon={{ ios: 'arrow.up.right', android: 'arrow_outward' }}
            first
          />
          <WaterRow />
          <WeightRow />
          <EntryRow
            label="Best set"
            icon={{ ios: 'dumbbell', android: 'fitness_center' }}
            hint="Not tracked yet"
          />
        </View>
      </View>
    </ThemedView>
  );
}

/**
 * Which day the sheet is adding to — the Log tab's selected day, which is not
 * necessarily today (history and up to 30 planned days ahead are both
 * loggable). Static: it states the target, it is not a second way to change it.
 */
function DateChip() {
  const { colors } = useTheme();
  const currentDate = useDiary((s) => s.currentDate);

  return (
    <View
      accessibilityLabel={`Adding to ${formatLongDate(currentDate)}`}
      style={[styles.chip, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
      <ThemedText type="micro" themeColor="textSecondary">
        {formatMonthShort(currentDate)}
      </ThemedText>
      <ThemedText type="h3" themeColor="inkStrong" tabular>
        {formatDayOfMonth(currentDate)}
      </ThemedText>
    </View>
  );
}

/**
 * One of the four food-capture methods, in the top grid. `onPress` is omitted
 * for the ones still awaiting a destination.
 */
function CaptureCell({
  label,
  icon,
  onPress,
  first,
}: {
  label: string;
  icon: Icon;
  onPress?: () => void;
  first?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        !first && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <SymbolView name={icon} size={24} tintColor={colors.inkStrong} fallback={<View />} />
      <ThemedText type="smBold">{label}</ThemedText>
    </Pressable>
  );
}

/**
 * A standalone log in the lower list. `hint` is the trailing value, and is
 * only ever a real one — a row with no data source says so rather than
 * showing a plausible number, the same promise the Vitals grid makes.
 * `onPress` is omitted for the ones still awaiting a destination.
 */
function EntryRow({
  label,
  hint,
  icon,
  onPress,
  first,
}: {
  label: string;
  hint?: string;
  icon: Icon;
  onPress?: () => void;
  first?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <>
      {first ? null : <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, hint].filter(Boolean).join(', ')}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <SymbolView name={icon} size={20} tintColor={colors.textSecondary} fallback={<View />} />
        <ThemedText type="h3" style={styles.rowLabel}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="sm" themeColor="textSecondary" tabular numberOfLines={1}>
            {hint}
          </ThemedText>
        ) : null}
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
          size={14}
          tintColor={colors.textTertiary}
          fallback={<View />}
        />
      </Pressable>
    </>
  );
}

/**
 * Today's hydration, from the MMKV cache.
 *
 * `replace`, not `push`, for the same reason the Search cell above uses it: the
 * sheet must not stay in the stack under the screen it opened.
 *
 * `useTodayWater` returning null means the cache describes another day, which
 * reads as "not logged yet" rather than "0 ml" — the day hasn't been loaded,
 * which is not the same as the user having drunk nothing.
 */
function WaterRow() {
  const router = useRouter();
  const today = useTodayWater();

  return (
    <EntryRow
      label="Water"
      icon={{ ios: 'drop', android: 'water_drop' }}
      hint={
        today === null
          ? 'Not logged yet'
          : `${formatVolume(today.totalMl)} of ${formatVolume(today.goalMl)}`
      }
      onPress={() => router.replace('/water')}
    />
  );
}

/** The weigh-in row, also read from the MMKV-cached summary. */
function WeightRow() {
  const currentKg = useWeight((s) => s.summary?.stats.currentKg ?? null);
  const unit = useWeight((s) => s.unit);

  return (
    <EntryRow
      label="Weight"
      icon={{ ios: 'figure.stand', android: 'monitor_weight' }}
      hint={currentKg === null ? 'Not logged yet' : formatWeight(currentKg, unit)}
    />
  );
}

const styles = StyleSheet.create({
  // No `flex: 1`: the sheet's `fitToContents` detent measures this subtree,
  // so it has to size to its content rather than to the screen. The top
  // corners are rounded here as well as natively, because this background
  // would otherwise square them off again.
  container: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.s8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
    paddingHorizontal: Spacing.s20,
    paddingTop: Spacing.s8,
    paddingBottom: Spacing.s8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    // A one-off between `h2` (22) and `h3` (17). The scale has no 20, and the
    // sheet's title should not carry as much weight as a screen heading —
    // it names a sheet you are about to act in, not a place you navigated to.
    fontSize: 20,
    lineHeight: 24,
  },
  chip: {
    // Matches the close button's size on the other side, so the centred title
    // sits on the true centre rather than off it.
    width: CONTROL_SIZE,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 2,
    transform: [{ translateY: -CONTROL_LIFT }],
  },
  lifted: {
    transform: [{ translateY: -CONTROL_LIFT }],
  },
  body: {
    paddingBottom: Spacing.s32,
  },
  grid: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.s8,
    paddingVertical: Spacing.s16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s16,
    paddingHorizontal: Spacing.s20,
    paddingVertical: Spacing.s16,
  },
  rowLabel: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.s20 + 20 + Spacing.s16,
  },
  pressed: {
    opacity: 0.6,
  },
});
