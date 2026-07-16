import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Radius, Spacing, useTheme } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <View style={[styles.mark, { backgroundColor: colors.primary }]}>
            <SymbolView
              name={{ ios: 'bolt.fill', android: 'bolt' }}
              size={44}
              tintColor={colors.onPrimary}
              fallback={<View />}
            />
          </View>
          <ThemedText type="h2" style={styles.brand}>
            Metabolizm
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Your swiss-knife for weight, calories, and macros. Let&apos;s build your personal plan
            in about 2 minutes.
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
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.s16 },
  mark: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { marginTop: Spacing.s8 },
  tagline: { textAlign: 'center', paddingHorizontal: Spacing.s16 },
  actions: { gap: Spacing.s16, paddingBottom: Spacing.s24 },
  signin: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
