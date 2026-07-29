import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-row';
import { usersApi } from '@/lib/api';
import { useProfile } from '@/store/profile';
import { Spacing } from '@/theme';

import {
  DEFAULT_REGION,
  REGION_LABELS,
  SUPPORTED_REGIONS,
  type Region,
} from '@metabolizm/shared';

/**
 * Food-database region.
 *
 * This RANKS search, it never filters it — an American product stays findable
 * for a New Zealander, just lower down. The copy says so deliberately: a user
 * who reads "region" as "hides food from other countries" would leave it alone
 * out of caution and never get the benefit.
 *
 * Written through `PATCH /v1/users/me`, whose `users` module is the single
 * writer of `users.region`. The local mirror on the profile store is what lets
 * the create-food energy toggle default to kJ without a round trip.
 */
export default function RegionScreen() {
  const profile = useProfile((s) => s.profile);
  const updateProfile = useProfile((s) => s.updateProfile);
  const current = profile?.region ?? DEFAULT_REGION;
  const [saving, setSaving] = useState<Region | null>(null);

  const select = (region: Region) => {
    if (region === current) return;
    setSaving(region);
    // Optimistic: the mirror drives local defaults, and the server call is
    // idempotent, so a failure just leaves the two briefly out of step until
    // the next launch pushes the device region again.
    updateProfile({ region });
    usersApi
      .updateMe({ region })
      .catch(() => {})
      .finally(() => setSaving(null));
  };

  return (
    <ThemedView style={styles.root}>
      <ScreenHeader title="Food database region" />
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsGroup title="REGION">
          {SUPPORTED_REGIONS.map((region, i) => (
            <SettingsRow
              key={region}
              first={i === 0}
              label={REGION_LABELS[region]}
              value={
                saving === region ? 'Saving…' : region === current ? 'Selected' : undefined
              }
              onPress={() => select(region)}
            />
          ))}
        </SettingsGroup>
        <ThemedText type="sm" themeColor="textSecondary">
          We put foods sold in your region first when you search. Nothing is
          hidden — you can still find and log food from anywhere.
        </ThemedText>
        <ThemedText type="sm" themeColor="textSecondary">
          Australia and New Zealand share a region, because most brands on the
          shelf are the same on both sides of the Tasman.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.s16, gap: Spacing.s16 },
});
