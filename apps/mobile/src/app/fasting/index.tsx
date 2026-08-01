import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatNumber } from '@/components/ui/stat-number';
import { useElapsedHours } from '@/hooks/use-elapsed';
import {
  FASTING_PROTOCOLS,
  TICK_MS_DETAIL,
  fastFraction,
  formatElapsed,
  formatElapsedPrecise,
  formatMoment,
  protocolLabel,
  remainingHours,
  sessionHours,
} from '@/lib/fasting';
import { haptics } from '@/lib/haptics';
import { useFasting } from '@/store/fasting';
import { Radius, Spacing, useTheme } from '@/theme';

import type { FastingProtocolId, FastingSessionDto } from '@metabolizm/shared';

/**
 * Fasting — start a window, watch it run, stop it.
 *
 * The screen has two states rather than one form: nothing running (pick a
 * protocol and start) and running (the live ring plus Stop). Presenting the
 * picker while a fast is in progress would invite changing the protocol
 * mid-window, which silently rewrites what the fast was measured against.
 *
 * Only the start timestamp is stored; everything on screen is derived from it
 * and the clock. That is what makes a fast resumed the next morning correct —
 * see `useElapsedHours`, which also recomputes on AppState resume.
 */
export default function FastingScreen() {
  const { colors } = useTheme();
  const refresh = useFasting((s) => s.refresh);
  const current = useFasting((s) => s.current);
  const sessions = useFasting((s) => s.sessions);
  const startFast = useFasting((s) => s.startFast);
  const endFast = useFasting((s) => s.endFast);
  const error = useFasting((s) => s.error);

  const [protocol, setProtocol] = useState<FastingProtocolId>('16:8');
  const hours = useElapsedHours(current?.startedAt ?? null, TICK_MS_DETAIL);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const selected =
    FASTING_PROTOCOLS.find((p) => p.id === protocol) ?? FASTING_PROTOCOLS[0];

  const start = () => {
    haptics.success();
    void startFast({ targetHours: selected.targetHours, protocol: selected.id });
  };

  const confirmStop = () => {
    Alert.alert(
      'End this fast?',
      `You're ${formatElapsed(hours)} in. It'll be saved to your history.`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End fast',
          style: 'destructive',
          onPress: () => {
            haptics.success();
            void endFast();
          },
        },
      ],
    );
  };

  const left = current ? remainingHours(hours, current.targetHours) : null;

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader
        title="Fasting"
        subtitle={current ? protocolLabel(current) : undefined}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {current ? (
          <>
            <View style={styles.hero}>
              <ProgressRing
                fraction={fastFraction(hours, current.targetHours)}
                size={160}
                strokeWidth={10}
                color={colors.accent}>
                <View style={styles.ringInner}>
                  <StatNumber value={formatElapsedPrecise(hours)} size="sm" />
                  <ThemedText type="sm" themeColor="textSecondary">
                    of {current.targetHours}h
                  </ThemedText>
                </View>
              </ProgressRing>
              <ThemedText type="body" themeColor="textSecondary">
                {left === null
                  ? "You've passed your target — end whenever you're ready."
                  : `${formatElapsed(left)} to go.`}
              </ThemedText>
              <ThemedText type="sm" themeColor="textTertiary">
                Started {formatMoment(current.startedAt)}
              </ThemedText>
            </View>

            <Button label="End fast" variant="secondary" fullWidth onPress={confirmStop} />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <ThemedText type="h2" themeColor="inkStrong">
                Not fasting
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                Pick a window and start whenever your last meal ended.
              </ThemedText>
            </View>

            <View style={styles.protocols}>
              {FASTING_PROTOCOLS.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: p.id === protocol }}
                  accessibilityLabel={`${p.label}. ${p.description}`}
                  onPress={() => {
                    haptics.select();
                    setProtocol(p.id);
                  }}
                  style={({ pressed }) => [
                    styles.protocol,
                    {
                      backgroundColor:
                        p.id === protocol ? colors.surfaceSunken : colors.surface,
                      borderColor: p.id === protocol ? colors.focusRing : colors.border,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smBold" themeColor="inkStrong" tabular>
                    {p.label}
                  </ThemedText>
                  <ThemedText type="micro" themeColor="textSecondary">
                    {p.targetHours}h
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="sm" themeColor="textTertiary">
              {selected.description}
            </ThemedText>

            <Button label={`Start ${selected.label}`} size="lg" fullWidth onPress={start} />
          </>
        )}

        {error ? (
          <ThemedText type="sm" themeColor="dangerText">
            {error}
          </ThemedText>
        ) : null}

        <ThemedText type="h3" themeColor="inkStrong" style={styles.historyHead}>
          History
        </ThemedText>

        {sessions.length === 0 ? (
          <ThemedText type="body" themeColor="textSecondary">
            Nothing yet. Your first completed window shows up here.
          </ThemedText>
        ) : (
          sessions.map((session) => <HistoryRow key={session.id} session={session} />)
        )}

        <ThemedText type="sm" themeColor="textTertiary" style={styles.footnote}>
          Intermittent fasting doesn&apos;t suit everyone — skip it if you&apos;re pregnant,
          managing diabetes, or have a history of disordered eating. Not medical advice.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function HistoryRow({ session }: { session: FastingSessionDto }) {
  const { colors } = useTheme();
  const hours = sessionHours(session);
  const hit = hours >= session.targetHours;

  return (
    <View style={[styles.historyRow, { borderBottomColor: colors.border }]}>
      <View style={styles.historyMain}>
        <ThemedText type="body" themeColor="inkStrong" tabular>
          {formatElapsed(hours)}
        </ThemedText>
        <ThemedText type="sm" themeColor="textSecondary">
          {formatMoment(session.startedAt)} · {protocolLabel(session)}
        </ThemedText>
      </View>
      <ThemedText type="sm" themeColor={hit ? 'successText' : 'textTertiary'} tabular>
        {hit ? 'target hit' : `of ${session.targetHours}h`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.s20,
    paddingBottom: Spacing.s48,
    gap: Spacing.s16,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.s8,
    paddingVertical: Spacing.s8,
  },
  ringInner: {
    alignItems: 'center',
    gap: 2,
  },
  centered: {
    textAlign: 'center',
  },
  protocols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s8,
  },
  protocol: {
    flexBasis: '18%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.s12,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  historyHead: {
    marginTop: Spacing.s8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
    paddingVertical: Spacing.s12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyMain: {
    flex: 1,
    gap: 2,
  },
  footnote: {
    marginTop: Spacing.s16,
  },
  pressed: {
    opacity: 0.7,
  },
});
