/**
 * The single boundary the app uses to keep home-screen widgets fresh:
 * `initWidgetSync()` (called once from the root layout) subscribes to the
 * diary + profile stores and app foregrounding, debounces bursts, and pushes
 * the current day's payload to the platform widget pipeline.
 */

import { AppState, Platform } from 'react-native';

import { useDiary } from '@/store/diary';
import { useProfile } from '@/store/profile';

import { buildWidgetData, waitForProfileHydration } from './data';

const DEBOUNCE_MS = 400;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let initialized = false;

export async function syncWidgetsNow(): Promise<void> {
  await waitForProfileHydration();
  const data = buildWidgetData();
  try {
    if (Platform.OS === 'ios') {
      const { updateIosWidgets } = await import('./ios');
      updateIosWidgets(data);
    } else if (Platform.OS === 'android') {
      const { updateAndroidWidgets } = await import('./android');
      await updateAndroidWidgets(data);
    }
  } catch (error) {
    // Widgets are best-effort decoration — never let them break app flows.
    console.warn('[widgets] sync failed', error);
  }
}

export function scheduleWidgetSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void syncWidgetsNow();
  }, DEBOUNCE_MS);
}

/** Idempotent; safe to call from a layout that may remount. */
export function initWidgetSync(): void {
  if (initialized) return;
  initialized = true;
  useDiary.subscribe(scheduleWidgetSync);
  useProfile.subscribe(scheduleWidgetSync);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleWidgetSync();
  });
  scheduleWidgetSync();
}
