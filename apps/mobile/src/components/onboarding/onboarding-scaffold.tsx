import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useCallback, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/lib/haptics';
import { Motion, Spacing, useTheme } from '@/theme';

type Props = {
  /** 0..1 completion of the flow, drives the progress bar. */
  progress: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Primary action. Omit to hide the default footer button (pass `footer`). */
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Replace the default Next button entirely. */
  footer?: ReactNode;
  showBack?: boolean;
};

export function OnboardingScaffold({
  progress,
  title,
  subtitle,
  children,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  footer,
  showBack = true,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          {showBack && router.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => pressed && styles.pressed}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back' }}
                size={22}
                tintColor={colors.textSecondary}
                fallback={<ThemedText themeColor="textSecondary">Back</ThemedText>}
              />
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <ProgressBar progress={progress} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText type="h2" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>

        <View style={styles.footer}>
          {footer ?? (
            <Button
              label={nextLabel}
              size="lg"
              fullWidth
              disabled={nextDisabled}
              onPress={() => {
                haptics.advance();
                onNext?.();
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

// The bar remounts with every step screen, so the previous step's fill is
// carried at module level — that's what lets each screen's bar animate from
// where the last one left off instead of appearing at its own width.
let lastProgress = 0;

function ProgressBar({ progress }: { progress: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const target = Math.max(0, Math.min(1, progress));
  // Held in state (not a ref) so it can be read during render without tripping
  // the react-hooks refs rule; created once via the lazy initializer.
  const [anim] = useState(() => new Animated.Value(lastProgress));

  // Focus (not just mount) so navigating back also re-syncs the carried value.
  useFocusEffect(
    useCallback(() => {
      lastProgress = target;
      Animated.timing(anim, {
        toValue: target,
        duration: reduceMotion ? 0 : Motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, [anim, target, reduceMotion]),
  );

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { backgroundColor: colors.ringTrack }]}>
      {/* Flow progress = an allowed accent role. */}
      <Animated.View style={[styles.fill, { width, backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s16,
    paddingHorizontal: Spacing.s24,
    paddingTop: Spacing.s8,
    paddingBottom: Spacing.s16,
  },
  backSpacer: { width: 22 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.s24,
    paddingBottom: Spacing.s24,
  },
  title: { marginTop: Spacing.s8 },
  subtitle: { marginTop: Spacing.s8 },
  body: { marginTop: Spacing.s24, gap: Spacing.s16 },
  footer: {
    paddingHorizontal: Spacing.s24,
    paddingTop: Spacing.s8,
    paddingBottom: Spacing.s8,
  },
  pressed: { opacity: 0.7 },
});
