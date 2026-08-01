import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useGroups } from '@/store/groups';
import { Fonts, useTheme } from '@/theme';

export default function AppTabs() {
  const { colors } = useTheme();
  const router = useRouter();
  // Things waiting on ME: invitations to answer, plus requests I can decide.
  // `pendingRequestCount` is already 0 for a plain member, so this can't count
  // something the user has no way to act on.
  const waiting = useGroups(
    (s) =>
      s.invitations.length +
      s.groups.reduce((sum, g) => sum + g.pendingRequestCount, 0),
  );

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      // Android only. Material's default is `auto`, which at 4+ tabs means
      // `selected`: labels are hidden until a tab is chosen, and the icon
      // slides up to make room for the one that appears. `labeled` keeps all
      // four destination labels on screen permanently — they stay readable
      // without tapping, and nothing moves on selection. No-op on iOS, where
      // UITabBar always labels its items.
      labelVisibilityMode="labeled"
      // Active item is the single allowed accent use in the nav: a lime pill
      // holding an `onAccent` icon, with the label accented beneath it.
      indicatorColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.onAccent }}
      labelStyle={{
        default: { fontFamily: Fonts.sansMedium, color: colors.textSecondary },
        // The M3 indicator pill wraps the icon only — the label sits below it
        // on `surface`, so it takes `accentText` (the accent-as-text role:
        // lime in dark, olive in light) and never `onAccent`. `onAccent` is
        // ink meant for the lime fill; on the dark surface it was ~1.4:1 and
        // the selected tab read as having no label at all.
        selected: { color: colors.accentText, fontFamily: Fonts.sansMedium },
      }}
      // Safety net for the `add` slot below. The raised button in
      // [add-button.tsx] covers that slot and normally swallows the press, so
      // this only runs if a touch reaches the native item anyway — in which
      // case `disabled` has already prevented the selection (the event still
      // fires), and the sheet opens rather than nothing happening.
      screenListeners={({ route }) =>
        route.name === 'add' ? { tabPress: () => router.push('/add-entry') } : {}
      }>
      {/* Log owns the index route so it's the landing tab. */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Log</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.and.pencil" md="edit_note" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="vitals">
        <NativeTabs.Trigger.Label>Vitals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform.path.ecg" md="monitor_heart" />
      </NativeTabs.Trigger>

      {/* The reserved middle slot. It renders nothing — no icon, no label —
          because the raised "+" in [add-button.tsx] is drawn over it; all this
          trigger does is make the native bar lay out five equal items so the
          four real destinations sit around the button instead of under it.
          `disabled` keeps the native tap inert (the tab is a sheet, not a
          destination), and `add.tsx` bounces to Log if anything ever routes
          here regardless. */}
      <NativeTabs.Trigger name="add" disabled>
        <NativeTabs.Trigger.Label hidden>Add</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="groups">
        <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
        {/* `hidden` at zero rather than the string "0": absence is not zero,
            the same promise the rest of Groups makes. */}
        <NativeTabs.Trigger.Badge hidden={waiting === 0}>
          {waiting > 0 ? String(waiting) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="toolbox">
        <NativeTabs.Trigger.Label>Toolbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="wrench.and.screwdriver.fill" md="handyman" />
      </NativeTabs.Trigger>

      {/* No Profile tab: it pushes at the root stack from the AppHeader's
          profile button instead. See src/app/profile/index.tsx. */}
    </NativeTabs>
  );
}
