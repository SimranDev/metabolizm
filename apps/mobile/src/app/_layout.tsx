import '@/global.css';

import {
  InstrumentSans_400Regular,
  InstrumentSans_400Regular_Italic,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useProfile } from '@/store/profile';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout + first-run gate. Loads fonts, sets the theme and splash overlay,
 * and routes to onboarding vs. the app based on the persisted `onboardingComplete`
 * flag. The `(onboarding)` group is only mounted (and its animation code only
 * evaluated) while a user is actually onboarding, so it never runs in the
 * everyday hot path.
 */
export default function RootLayout() {
  const hydrated = useProfile((s) => s.hydrated);
  const onboardingComplete = useProfile((s) => s.onboardingComplete);
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_400Regular_Italic,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  // Hold the native splash until fonts AND the persisted profile are ready, so we
  // never flash the wrong route (onboarding vs. app) before hydration completes.
  if ((!fontsLoaded && !fontError) || !hydrated) {
    return null;
  }

  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-food" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="food-detail" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboardingComplete}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
      </Stack>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}

/**
 * The single app-wide status bar, fed by the same theme context as the color
 * tokens so it flips with the scheme. No screen may set its own style.
 */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
