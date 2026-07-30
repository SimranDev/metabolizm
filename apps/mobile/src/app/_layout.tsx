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
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { usersApi } from '@/lib/api';
import { routeFromNotification } from '@/lib/push';
import { initDayRollover } from '@/store/diary';
import { useProfile, useProfileHydrated } from '@/store/profile';
import { Radius, ThemeProvider, useTheme } from '@/theme';
import { initWidgetSync } from '@/widgets/sync';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout + first-run gate. Loads fonts, sets the theme and splash overlay,
 * and routes to onboarding vs. the app based on the persisted `onboardingComplete`
 * flag. The `(onboarding)` group is only mounted (and its animation code only
 * evaluated) while a user is actually onboarding, so it never runs in the
 * everyday hot path.
 */
export default function RootLayout() {
  const hydrated = useProfileHydrated();
  const onboardingComplete = useProfile((s) => s.onboardingComplete);
  const router = useRouter();
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

  // Keep the home-screen widgets fed with today's diary data.
  useEffect(() => {
    initWidgetSync();
  }, []);

  // Follow midnight while the app is backgrounded, so an app resumed the next
  // morning isn't still showing (and logging into) yesterday.
  useEffect(() => initDayRollover(), []);

  // The server defaults users.timezone to UTC and this is its only writer, yet
  // entry dates, logging streaks and every group's notion of "today" pivot on
  // it. Pushed once per launch, fire-and-forget: a signed-out or offline
  // device simply tries again next time. The auth screens push it again right
  // after sign-in/sign-up, when a session finally exists.
  useEffect(() => {
    usersApi.pushDeviceTimezone();
    usersApi.pushDeviceRegion();
  }, []);

  // Tapping a notification. Two sources, because a tap that launched the app
  // cold has already happened by the time any listener could attach:
  // `getLastNotificationResponseAsync` catches that one, the subscription
  // catches every tap while the app is running.
  useEffect(() => {
    if (!onboardingComplete) return;

    let handled = false;
    const go = (response: Notifications.NotificationResponse | null) => {
      const route = routeFromNotification(response);
      // Guarded on onboardingComplete above: /invitations lives inside
      // Stack.Protected, so navigating there mid-onboarding targets a screen
      // that isn't mounted.
      if (!route || handled) return;
      handled = true;
      router.push('/invitations');
    };

    void Notifications.getLastNotificationResponseAsync().then(go);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handled = false;
      go(response);
    });
    return () => subscription.remove();
  }, [onboardingComplete, router]);

  // Hold the native splash until fonts AND the persisted profile are ready, so we
  // never flash the wrong route (onboarding vs. app) before hydration completes.
  if ((!fontsLoaded && !fontError) || !hydrated) {
    return null;
  }

  return (
    // Required by react-native-gesture-handler, which backs the weight
    // chart's scrub. Without it gestures silently never fire on Android.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={onboardingComplete}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-food" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="food-detail" options={{ presentation: 'fullScreenModal' }} />
            {/* Reached from the "Can't find it?" row at the bottom of search
                (including the no-results state). Replaces itself with the
                food it creates, so the created food's detail is not stranded
                behind a create form in the back stack. */}
            <Stack.Screen name="create-food" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="scan-barcode" options={{ presentation: 'fullScreenModal' }} />
            {/* The add-food selection, reviewable before it is committed. A
                form sheet over the add-food modal, so the results list stays
                visible behind it. A fixed detent rather than `fitToContents`:
                the list is however many foods the user picked, so the content
                has to be allowed to scroll inside a known height. */}
            <Stack.Screen
              name="review-selection"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.7],
                sheetCornerRadius: Radius.sheet,
                sheetGrabberVisible: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            {/* Groups drill-downs push above the tabs — they carry their own
                header, since the persistent AppHeader belongs to the tab group.
                Create and join are pushes, not modals: both `replace` themselves
                with the group they just produced, which would otherwise leave
                the group detail stuck in a modal presentation. */}
            <Stack.Screen name="group/[id]" />
            <Stack.Screen name="member-day" />
            <Stack.Screen name="create-group" />
            <Stack.Screen name="join-group" />
            {/* Invitations: the inbox, the send form, and a group's sent list.
                `invitations` is also where a notification tap will land. */}
            <Stack.Screen name="invitations" />
            <Stack.Screen name="invite-member" />
            <Stack.Screen name="group-invites" />
            <Stack.Screen name="group-sharing" options={{ presentation: 'modal' }} />
            {/* Profile & settings — reached from the AppHeader's profile
                button, not a tab: the tab bar is for what you open daily.
                Each setting is its own screen under `profile/`, so the index
                stays a scannable list of rows as settings accumulate. */}
            <Stack.Screen name="profile/index" />
            <Stack.Screen name="profile/targets" />
            <Stack.Screen name="profile/goal" />
            <Stack.Screen name="profile/units" />
            <Stack.Screen name="profile/region" />
            <Stack.Screen name="profile/appearance" />
            {/* The add sheet, opened by the raised "+" in the middle of the
                tab bar. Same native form sheet as the calendar below, and at
                the root stack for the same reason: it opens over any tab. */}
            <Stack.Screen
              name="add-entry"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: 'fitToContents',
                sheetCornerRadius: Radius.sheet,
                // The screen draws its own handle: `sheetGrabberVisible` is
                // iOS-only, so relying on it leaves Android with no drag
                // affordance at all.
                sheetGrabberVisible: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            {/* The calendar. A native form sheet, so the OS owns the drag,
                detents and dismiss — no bottom-sheet library in the bundle. */}
            <Stack.Screen
              name="day-picker"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75],
                sheetGrabberVisible: true,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            {/* Weight drill-downs, same reasoning as the groups ones. */}
            <Stack.Screen name="weight/index" />
            <Stack.Screen name="weight/history" />
          </Stack.Protected>
          <Stack.Protected guard={!onboardingComplete}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
        </Stack>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
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
