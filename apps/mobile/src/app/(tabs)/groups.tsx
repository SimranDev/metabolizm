import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GroupCard } from '@/components/groups/group-card';
import { InvitationCard } from '@/components/groups/invitation-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { haptics } from '@/lib/haptics';
import { registerForPush } from '@/lib/push';
import { useGroups } from '@/store/groups';
import { BottomTabInset, Radius, Spacing, useTheme } from '@/theme';

/**
 * Groups tab — private accountability circles. The list is served from the
 * persisted store so it paints instantly, then refreshes whenever the tab
 * regains focus (joining or leaving happens on other routes).
 */
export default function GroupsScreen() {
  const router = useRouter();
  const groups = useGroups((s) => s.groups);
  const invitations = useGroups((s) => s.invitations);
  const status = useGroups((s) => s.status);
  const error = useGroups((s) => s.error);
  const refresh = useGroups((s) => s.refresh);
  const refreshInvitations = useGroups((s) => s.refreshInvitations);
  const declineInvitation = useGroups((s) => s.declineInvitation);

  const [decliningId, setDecliningId] = useState<string | null>(null);

  const onDecline = async (id: string) => {
    setDecliningId(id);
    try {
      await declineInvitation(id);
      haptics.success();
    } catch {
      // The card stays put and the next focus refresh reconciles it — a
      // failed decline shouldn't push an error banner onto the tab.
    } finally {
      setDecliningId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshInvitations();
    }, [refresh, refreshInvitations]),
  );

  // Ask for notifications here, not at launch. Groups is the only thing that
  // sends any, so this is the one screen where the prompt has a visible reason
  // behind it — and the OS only ever offers it once.
  useEffect(() => {
    void registerForPush();
  }, []);

  // An invitation counts as content. Otherwise someone invited to their first
  // group lands on the empty state, which replaces the list entirely, and the
  // invitation they were notified about is nowhere on the screen.
  const empty = groups.length === 0 && invitations.length === 0;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.titleRow}>
        <ThemedText type="h1">Groups</ThemedText>
        {!empty ? (
          <IconButton
            variant="primary"
            accessibilityLabel="Create a group"
            onPress={() => router.push('/create-group')}
            icon={(color) => (
              <SymbolView
                name={{ ios: 'plus', android: 'add' }}
                size={18}
                tintColor={color}
                fallback={<View />}
              />
            )}
          />
        ) : null}
      </View>

      {empty && status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : empty ? (
        <EmptyState
          onCreate={() => router.push('/create-group')}
          onJoin={() => router.push('/join-group')}
          error={status === 'error' ? error : null}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {status === 'error' && error ? (
            <ThemedText type="sm" themeColor="dangerText">
              {error}
            </ThemedText>
          ) : null}

          {invitations.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="micro" themeColor="textTertiary">
                {invitations.length === 1 ? 'Invitation' : `Invitations · ${invitations.length}`}
              </ThemedText>
              {invitations.slice(0, INVITATIONS_ON_TAB).map((invitation) => (
                <InvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  declining={decliningId === invitation.id}
                  onReview={() =>
                    router.push({
                      pathname: '/join-group',
                      params: { invitationId: invitation.id },
                    })
                  }
                  onDecline={() => void onDecline(invitation.id)}
                />
              ))}
              {invitations.length > INVITATIONS_ON_TAB ? (
                <Button
                  label={`See all ${invitations.length} invitations`}
                  variant="ghost"
                  onPress={() => router.push('/invitations')}
                  fullWidth
                />
              ) : null}
            </View>
          ) : null}

          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
            />
          ))}

          <InviteCard onPress={() => router.push('/join-group')} />
        </ScrollView>
      )}
    </ThemedView>
  );
}

/** Beyond this the tab becomes an inbox; the rest live on /invitations. */
const INVITATIONS_ON_TAB = 2;

function EmptyState({
  onCreate,
  onJoin,
  error,
}: {
  onCreate: () => void;
  onJoin: () => void;
  error: string | null;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSunken }]}>
        <SymbolView
          name={{ ios: 'person.2.fill', android: 'group' }}
          size={32}
          tintColor={colors.textTertiary}
          fallback={<View />}
        />
      </View>

      <ThemedText type="h2" style={styles.centerText}>
        Train together, privately
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>
        Groups compare consistency, not calories. You choose what each group sees — and you
        can change it any time.
      </ThemedText>

      {error ? (
        <ThemedText type="sm" themeColor="dangerText" style={styles.centerText}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.emptyActions}>
        <Button label="Create a group" onPress={onCreate} fullWidth />
        <Button label="Join with an invite" variant="secondary" onPress={onJoin} fullWidth />
      </View>
    </View>
  );
}

function InviteCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={[styles.inviteCard, { borderColor: colors.borderStrong }]}>
        <SymbolView
          name={{ ios: 'link', android: 'link' }}
          size={20}
          tintColor={colors.textSecondary}
          fallback={<View />}
        />
        <View style={styles.inviteText}>
          <ThemedText type="smBold">Have an invite?</ThemedText>
          <ThemedText type="sm" themeColor="textSecondary">
            Open the link or paste the code to see what you&apos;d share before joining.
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.s24,
    paddingTop: Spacing.s16,
    paddingBottom: Spacing.s12,
  },
  content: {
    paddingHorizontal: Spacing.s24,
    paddingBottom: BottomTabInset + Spacing.s24,
    gap: Spacing.s16,
  },
  section: {
    gap: Spacing.s8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.s16,
    paddingHorizontal: Spacing.s32,
    paddingBottom: BottomTabInset,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.s8,
  },
  centerText: {
    textAlign: 'center',
  },
  emptyActions: {
    alignSelf: 'stretch',
    gap: Spacing.s12,
    marginTop: Spacing.s16,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s16,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
  },
  inviteText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
