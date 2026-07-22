import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { SocialAuthButtons } from '@/components/onboarding/social-auth-buttons';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { usersApi } from '@/lib/api';
import { signIn } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { answersFromProfile } from '@/lib/onboarding-metrics';
import { useOnboarding } from '@/store/onboarding';
import { useProfile } from '@/store/profile';
import { useWeight } from '@/store/weight';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only existing accounts reach here (the server rejects unknown social
  // logins). Restore their saved profile and let them review it instead of
  // re-onboarding; a legacy account with no server profile is sent to setup.
  const onSignedIn = async () => {
    haptics.success();
    // A session exists now, so this is the first call that can actually land.
    usersApi.pushDeviceTimezone();
    try {
      const { profile } = await usersApi.getMyProfile();
      if (profile) {
        useOnboarding.getState().set(answersFromProfile(profile, useWeight.getState().unit));
        router.replace('/review');
        return;
      }
    } catch {
      // Offline or the fetch failed — fall back to a device-local profile if
      // this phone has one, so a returning user isn't blocked from their app.
      const local = useProfile.getState().profile;
      if (local) {
        useProfile.getState().completeOnboarding(local);
        return;
      }
    }
    // No saved profile (a pre-feature account) — send them through onboarding.
    router.replace('/goal');
  };

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      await onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      progress={0}
      title="Welcome back"
      subtitle="Sign in to sync your plan and history."
      nextLabel={submitting ? 'Signing in…' : 'Sign in'}
      nextDisabled={submitting || !email || !password}
      onNext={onSubmit}>
      {/* Above the social buttons on purpose. Social sign-in fails up here, so
          an error rendered after the email/password fields sits off-screen and
          the provider button just looks inert. */}
      {error ? (
        <ThemedText type="sm" themeColor="dangerText" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <SocialAuthButtons
        mode="sign-in"
        busy={submitting}
        onStart={() => {
          setError(null);
          setSubmitting(true);
        }}
        onSuccess={onSignedIn}
        onCancel={() => setSubmitting(false)}
        onError={(message) => {
          setError(message);
          setSubmitting(false);
        }}
      />

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
      />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  error: { textAlign: 'center' },
});
