/**
 * App-side widget payload builder — reads the diary + profile stores and
 * derives today's totals. Runs in the full RN runtime (foreground app on both
 * platforms, and Android's headless widget task), never inside a widget.
 */

import { todayKey, useDiary } from '@/store/diary';
import { useProfile } from '@/store/profile';

import type { WidgetDayData } from './types';

/** Shown before onboarding completes, so widgets render something sensible. */
const FALLBACK_TARGET_CALORIES = 2000;
const FALLBACK_MACROS = { proteinG: 150, carbsG: 200, fatG: 67 };

export function buildWidgetData(now = new Date()): WidgetDayData {
  const dateKey = todayKey(now);
  const day = useDiary.getState().entriesByDate[dateKey];
  const { profile } = useProfile.getState();

  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let mealsLogged = 0;
  for (const entries of Object.values(day ?? {})) {
    if (entries.length > 0) mealsLogged++;
    for (const entry of entries) {
      calories += entry.calories;
      proteinG += entry.macros.proteinG;
      carbsG += entry.macros.carbsG;
      fatG += entry.macros.fatG;
    }
  }

  const targets = profile?.macros ?? FALLBACK_MACROS;
  return {
    dateKey,
    hasProfile: profile != null,
    targetCalories: profile?.targetCalories ?? FALLBACK_TARGET_CALORIES,
    consumedCalories: calories,
    carbs: { consumedG: carbsG, targetG: targets.carbsG },
    fat: { consumedG: fatG, targetG: targets.fatG },
    protein: { consumedG: proteinG, targetG: targets.proteinG },
    mealsLogged,
  };
}

/**
 * The profile store persists via AsyncStorage (async hydration) — the Android
 * headless widget task can run before it finishes. The diary store (MMKV)
 * hydrates synchronously and needs no waiting.
 */
export function waitForProfileHydration(timeoutMs = 2000): Promise<void> {
  if (useProfile.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, timeoutMs);
    const unsubscribe = useProfile.persist.onFinishHydration(() => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}
