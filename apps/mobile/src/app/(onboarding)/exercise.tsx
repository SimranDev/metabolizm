import { useRouter } from 'expo-router';

import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { OptionCard } from '@/components/onboarding/option-card';
import { activityLevelFrom, type ExerciseBand } from '@/lib/health';
import { stepProgress } from '@/lib/onboarding-steps';
import { useOnboarding } from '@/store/onboarding';

const BANDS: { value: ExerciseBand; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No deliberate training right now' },
  { value: 'light', label: '1–3 sessions / week', description: 'A few workouts, not every day' },
  { value: 'regular', label: '4–6 sessions / week', description: 'Training most days' },
  { value: 'daily', label: '7+ sessions / week', description: 'Daily, or more than once a day' },
  {
    value: 'unsure',
    label: "I'm not sure",
    description: "We'll assume a couple of sessions a week and you can correct it later",
  },
];

export default function ExerciseScreen() {
  const router = useRouter();
  const exerciseBand = useOnboarding((s) => s.exerciseBand);
  const neatLevel = useOnboarding((s) => s.neatLevel);
  const set = useOnboarding((s) => s.set);

  return (
    <OnboardingScaffold
      progress={stepProgress('exercise')}
      title="How often do you train?"
      subtitle="Count recreational sport, cardio and resistance training. Everyday movement comes next — we ask separately because the two move independently."
      nextDisabled={!exerciseBand}
      onNext={() => router.push('/activity')}>
      {BANDS.map((band) => (
        <OptionCard
          key={band.value}
          label={band.label}
          description={band.description}
          selected={exerciseBand === band.value}
          onPress={() =>
            set({
              exerciseBand: band.value,
              // Keep the derived level in step whenever either half changes.
              ...(neatLevel ? { activityLevel: activityLevelFrom(neatLevel, band.value) } : null),
            })
          }
        />
      ))}
    </OnboardingScaffold>
  );
}
