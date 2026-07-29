import { useRouter } from 'expo-router';

import { LiveReadout } from '@/components/onboarding/live-readout';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { OptionCard } from '@/components/onboarding/option-card';
import { activityLevelFrom, maintenanceCalories, type NeatLevel } from '@/lib/health';
import { buildMetrics } from '@/lib/onboarding-metrics';
import { stepProgress } from '@/lib/onboarding-steps';
import { useOnboarding } from '@/store/onboarding';

/**
 * Non-exercise activity only — training was asked on the previous step. The two
 * are combined by `activityLevelFrom` into the single `ActivityLevel` the rest
 * of the app consumes.
 */
const LEVELS: { value: NeatLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Mostly seated', description: 'Desk work, driving, little walking' },
  { value: 'moderate', label: 'On my feet some', description: 'Regular walking or errands' },
  { value: 'very', label: 'On my feet all day', description: 'Physical work, or constant walking' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const answers = useOnboarding();
  const { neatLevel, exerciseBand, set } = answers;

  // Live maintenance calories once both halves are in (all other inputs are).
  const metrics = buildMetrics(answers);
  const tdeeValue = metrics ? Math.round(maintenanceCalories(metrics)) : null;

  return (
    <OnboardingScaffold
      progress={stepProgress('activity')}
      title="How active is the rest of your day?"
      subtitle="Everything outside training — work, errands, walking. This is often the bigger share of what you burn."
      nextDisabled={!neatLevel}
      onNext={() => router.push('/plan')}>
      {LEVELS.map((l) => (
        <OptionCard
          key={l.value}
          label={l.label}
          description={l.description}
          selected={neatLevel === l.value}
          onPress={() =>
            set({
              neatLevel: l.value,
              activityLevel: activityLevelFrom(l.value, exerciseBand ?? 'light'),
            })
          }
        />
      ))}

      {tdeeValue != null ? (
        <LiveReadout
          items={[{ label: 'Maintenance', value: `${tdeeValue.toLocaleString()} cal/day` }]}
        />
      ) : null}
    </OnboardingScaffold>
  );
}
