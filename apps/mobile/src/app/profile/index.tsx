import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { DeleteAccountSheet } from '@/components/profile/delete-account-sheet';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-row';
import { endSession } from '@/lib/session';
import { formatWeight } from '@/lib/weight';
import { useProfile } from '@/store/profile';
import { useWeight } from '@/store/weight';
import { Spacing, THEME_PREFERENCE_OPTIONS, useThemePreference } from '@/theme';

import { DEFAULT_REGION, REGION_LABELS } from '@metabolizm/shared';

/**
 * Profile & settings.
 *
 * Where the numbers agreed during onboarding become editable, and the only way
 * out of the account — via `lib/session`, which wipes every account-scoped
 * store rather than just dropping the cookie.
 *
 * Pushes at the ROOT stack from the AppHeader's profile button rather than
 * owning a tab: it is the lowest-frequency destination in the app, and the tab
 * bar is for the surfaces you come back to every day. Like the groups and
 * weight drill-downs it therefore carries its own ScreenHeader.
 *
 * It lives at `profile/index.tsx`, not `profile.tsx`. A sibling `profile.tsx`
 * and `profile/` directory resolve to the same URL, and whichever one loses is
 * silently unreachable — the same collision that once trapped every user on the
 * onboarding height step (see the note in `(onboarding)/current-weight.tsx`).
 *
 * Each row is a door to a single-purpose screen rather than another card on one
 * long page: the list stays scannable as settings accumulate, and a row can show
 * its current value so the group reads as a summary.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile((s) => s.profile);
  const unit = useWeight((s) => s.unit);
  const goal = useWeight((s) => s.goal);
  const preference = useThemePreference((s) => s.preference);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your diary, weight history and groups are removed from this device. Anything already synced stays on your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            // The root layout swaps back to the onboarding stack the moment
            // the profile clears, so there is no navigation to do here.
            void endSession().finally(() => setSigningOut(false));
          },
        },
      ],
    );
  };

  const goalKg = goal?.targetWeightKg ?? profile?.goalWeightKg ?? null;
  const themeLabel =
    THEME_PREFERENCE_OPTIONS.find((o) => o.value === preference)?.label ?? 'System';

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Profile" />

      {/* Unreachable in practice (the root gate requires onboarding), but the
          header above still gives a way back if it ever renders. */}
      {!profile ? null : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SettingsGroup title="ACCOUNT">
            <SettingsRow first label="Signed in as" value={profile.email} />
          </SettingsGroup>

          <SettingsGroup title="NUTRITION">
            <SettingsRow
              first
              label="Daily targets"
              value={`${profile.targetCalories.toLocaleString()} cal`}
              onPress={() => router.push('/profile/targets')}
            />
            <SettingsRow
              label="Goal weight"
              value={goalKg != null ? formatWeight(goalKg, unit) : 'Not set'}
              onPress={() => router.push('/profile/goal')}
            />
          </SettingsGroup>

          <SettingsGroup title="PREFERENCES">
            <SettingsRow
              first
              label="Units"
              value={`${unit} · ${profile.heightUnit === 'cm' ? 'cm' : 'ft/in'}`}
              onPress={() => router.push('/profile/units')}
            />

            <SettingsRow
              label="Food database region"
              value={REGION_LABELS[profile.region ?? DEFAULT_REGION]}
              onPress={() => router.push('/profile/region')}
            />
            <SettingsRow
              label="Appearance"
              value={themeLabel}
              onPress={() => router.push('/profile/appearance')}
            />
          </SettingsGroup>

          <View style={styles.danger}>
            <Button
              label={signingOut ? 'Signing out…' : 'Sign out'}
              variant="ghost"
              onPress={confirmSignOut}
              disabled={signingOut}
              fullWidth
            />
            {/* Ghost, not a red button: the weight belongs on the confirmation
                step, where the consequences are actually spelled out. A
                destructive-looking control here is just a thing to mis-tap. */}
            <Button
              label="Delete account"
              variant="ghost"
              onPress={() => setDeleteOpen(true)}
              disabled={signingOut}
              fullWidth
            />
          </View>
        </ScrollView>
      )}

      <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.s16,
    paddingBottom: Spacing.s48,
    gap: Spacing.s24,
  },
  danger: { marginTop: Spacing.s8, gap: Spacing.s4 },
});
