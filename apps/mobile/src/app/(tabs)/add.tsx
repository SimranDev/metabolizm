import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ThemedView } from '@/components/themed-view';

/**
 * The tab bar's reserved middle slot — a route only so `NativeTabs` has a
 * fifth trigger to lay out. It is never meant to be shown: the raised "+" in
 * [../../components/add-button.tsx] covers the slot and opens the
 * `add-entry` sheet, and the trigger itself is `disabled`.
 *
 * The redirect is the failsafe for the one hole `disabled` leaves — it only
 * suppresses the *native* tap, so a stray `router.push('/add')` would still
 * land here. Bouncing to Log costs nothing and is better than a blank tab.
 * It runs on focus rather than mount so it can never fire while the navigator
 * is preloading screens in the background.
 */
export default function AddSlotScreen() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      router.replace('/');
    }, [router]),
  );

  return <ThemedView style={{ flex: 1 }} />;
}
