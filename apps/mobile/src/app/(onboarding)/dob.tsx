import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { DateWheel } from '@/components/onboarding/date-wheel';
import { LiveReadout } from '@/components/onboarding/live-readout';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { ageFromDob } from '@/lib/health';
import { stepProgress } from '@/lib/onboarding-steps';
import { useOnboarding } from '@/store/onboarding';

/**
 * Youngest and oldest dates the wheel offers. `MIN_AGE` is enforced by the
 * bounds themselves rather than by a validation message — an under-age date is
 * not reachable, so there is nothing to warn about.
 */
const MIN_AGE = 13;
const MAX_AGE = 120;
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
};

export default function DobScreen() {
  const router = useRouter();
  const storedDob = useOnboarding((s) => s.dob);
  const set = useOnboarding((s) => s.set);

  const bounds = useMemo(() => ({ min: yearsAgo(MAX_AGE), max: yearsAgo(MIN_AGE) }), []);
  const [date, setDate] = useState<Date>(() => (storedDob ? new Date(storedDob) : yearsAgo(30)));

  const age = ageFromDob(date);

  return (
    <OnboardingScaffold
      progress={stepProgress('dob')}
      title="When were you born?"
      subtitle="Metabolism slows with age, so this shifts your calorie baseline. It is never shown to anyone else."
      onNext={() => {
        set({ dob: date.toISOString() });
        router.push('/height');
      }}>
      <DateWheel value={date} onChange={setDate} min={bounds.min} max={bounds.max} />
      <LiveReadout items={[{ label: 'Your age', value: `${age} yrs` }]} />
    </OnboardingScaffold>
  );
}
