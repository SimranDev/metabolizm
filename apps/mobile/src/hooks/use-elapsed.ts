import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { elapsedHours } from '@/lib/fasting';

/**
 * Hours elapsed since `startedAt`, recomputed on an interval while mounted.
 *
 * Three rules this exists to keep:
 *
 * - **The interval only runs while something is showing it.** Passing a null
 *   `startedAt` schedules nothing at all, so a device with no fast running has
 *   no timer firing anywhere in the app.
 * - **The tick matches the precision on screen.** A tile that renders hours and
 *   minutes ticks a minute; only the detail screen, which shows seconds, ticks
 *   a second. Ticking faster than the display changes is pure battery.
 * - **Resume recomputes immediately.** A backgrounded app gets no timers, so
 *   without the AppState listener a fast resumed the next morning would show
 *   the hours it had when the phone went to sleep and then creep forward from
 *   there — a confidently wrong number, which is the failure mode this whole
 *   codebase is built to avoid.
 */
export function useElapsedHours(startedAt: string | null, tickMs: number): number {
  // State holds the CLOCK, not the elapsed figure, and the derived value below
  // reads it. Two reasons it is shaped this way: the effect never calls
  // setState in its own body (which cascades renders), and the returned number
  // genuinely depends on a piece of state — so reactCompiler, which is on, can
  // memoize it without freezing a timer that must keep moving.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;

    const update = () => setNow(Date.now());
    const interval = setInterval(update, tickMs);
    // A backgrounded app gets no timers, so resume has to recompute by hand.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [startedAt, tickMs]);

  return startedAt === null ? 0 : elapsedHours(startedAt, new Date(now));
}
