import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/**
 * Height of the native tab bar's item row, excluding the bottom safe-area
 * inset the OS adds underneath it.
 *
 * iOS is UIKit's standard 49pt. Android is 64dp rather than Material 3's
 * default 80dp because `plugins/with-tab-bar-density.js` overrides the AAR
 * dimensions — keep the two in step if that plugin's numbers change.
 */
const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 64 }) ?? 49;

/**
 * Distance from the tab bar's top edge to the centre of a tab item's **icon**
 * — not to the centre of the bar. A tab item is an icon stacked over a label,
 * so its icon line sits well above the bar's midpoint; centring the circle in
 * the bar instead leaves it visibly low against the four icons beside it.
 *
 * iOS: ~8pt inset + a 25pt image. Android: the 6dp top padding this repo's
 * density plugin sets, plus half of Material's 32dp indicator.
 */
const ICON_CENTER_Y = Platform.select({ ios: 20, android: 22 }) ?? 20;

/**
 * How far above the icon line the circle sits. The four items beside it are an
 * icon *plus* a label, so their visual mass hangs below their icon; a circle
 * with nothing under it needs a little lift to read as level with them.
 */
const LIFT = 4;

/** Diameter of the circle. The hit target is the whole slot, not just this. */
const FAB_SIZE = 40;

/** The tab bar lays out five equal items; the button owns the middle one. */
const SLOT_WIDTH = `${100 / 5}%` as const;

/**
 * The "+" in the middle of the bottom nav — the app's single primary action,
 * opening the add sheet ([../app/add-entry.tsx]).
 *
 * A native tab bar has no way to render a custom item, so this is an overlay
 * drawn on top of it from the tabs layout. What keeps that honest is the
 * matching `add` trigger in [app-tabs.tsx]: it reserves a real, `disabled`
 * fifth slot, so the native bar lays its four destinations out around the
 * button instead of underneath it, and a tap that misses this Pressable
 * cannot select anything. The Pressable deliberately covers the whole slot,
 * not just the visible circle, so no touch falls through to the inert item.
 *
 * `box-none` on the container is what keeps the rest of the bar tappable.
 *
 * **Flat and neutral, not an accent.** No shadow (which in dark would draw
 * nothing anyway — see `Elevation`), and the fill is the `actionNeutral` role:
 * the same grey-green family as the inactive tabs' `textSecondary`, a step
 * stronger, so it reads as the most prominent item in the bar without
 * competing with the lime indicator that marks which tab you are actually on.
 */
export function AddButton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: insets.bottom, height: TAB_BAR_HEIGHT }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        accessibilityHint="Opens the add sheet"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/add-entry');
        }}
        style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
        <View style={[styles.circle, { backgroundColor: colors.actionNeutral }]}>
          <SymbolView
            name={{ ios: 'plus', android: 'add' }}
            size={22}
            tintColor={colors.onActionNeutral}
            fallback={<View />}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    // Five equal slots means the middle one is centred on the bar, so the
    // button only has to centre itself — no per-slot measurement.
    justifyContent: 'center',
  },
  slot: {
    width: SLOT_WIDTH,
    alignItems: 'center',
    // Top-aligned, then offset onto the icon line below. Centring here would
    // put the circle on the bar's midpoint instead.
    justifyContent: 'flex-start',
  },
  circle: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // `marginTop` rather than the slot's `paddingTop`, because this goes
    // negative on both platforms once LIFT is applied and padding cannot.
    marginTop: ICON_CENTER_Y - FAB_SIZE / 2 - LIFT,
  },
  pressed: {
    opacity: 0.7,
  },
});
