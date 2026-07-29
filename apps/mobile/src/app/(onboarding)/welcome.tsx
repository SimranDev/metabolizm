import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Fonts, Radius, Spacing, useTheme } from '@/theme';

// Theme-aware brand mark: the dark heart reads on the light background, the
// light heart on the dark one. Both are the transparent artwork, no tile.
const LOGO = {
  light: require('@/assets/images/logo-light.webp'),
  dark: require('@/assets/images/logo-dark.webp'),
};

const HEADLINE = ['Built on formulas.', 'Held together by friends.'];

export default function WelcomeScreen() {
  const router = useRouter();
  const { scheme, colors } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.brand}>
          <Image source={LOGO[scheme]} style={styles.logo} contentFit="contain" />
          <ThemedText themeColor="text" style={styles.wordmark}>
            Metabolizm
          </ThemedText>
        </View>

        <View style={styles.hero}>
          <View style={styles.headline}>
            {HEADLINE.map((line) => (
              <View key={line} style={[styles.highlight, { backgroundColor: colors.accent }]}>
                <ThemedText style={[styles.highlightText, { color: colors.onAccent }]}>
                  {line}
                </ThemedText>
              </View>
            ))}
          </View>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Weight, calories, and macros in one place. Build your plan in about 2 minutes.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Button label="Get started" size="lg" fullWidth onPress={() => router.push('/goal')} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sign-in')}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="sm" themeColor="textSecondary" style={styles.signin}>
              Already have an account?{' '}
              <ThemedText type="smBold" themeColor="primary">
                Sign in
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.s24 },

  brand: { alignItems: 'center', gap: Spacing.s12, marginTop: Spacing.s64 },
  logo: { width: 116, height: 96 },
  wordmark: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.s20 },
  headline: { alignItems: 'center', gap: Spacing.s8 },
  highlight: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.s12,
    paddingVertical: Spacing.s4,
    borderRadius: Radius.sm,
  },
  highlightText: {
    fontFamily: Fonts.displayBold,
    fontSize: 26,
    lineHeight: 33,
    textAlign: 'center',
  },
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.s16, maxWidth: 340 },

  actions: { gap: Spacing.s16, paddingBottom: Spacing.s24 },
  signin: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
