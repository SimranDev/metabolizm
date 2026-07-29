import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { InvitationCard } from '@/components/groups/invitation-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CATEGORY_LABEL } from '@/lib/groups';
import { haptics } from '@/lib/haptics';
import { useGroups } from '@/store/groups';
import { Spacing, useTheme } from '@/theme';

/**
 * Invitations waiting for me.
 *
 * The Groups tab shows these too, but this route is the one a notification tap
 * can land on and the place the list lives when it outgrows the tab. Reviewing
 * an invitation hands off to the join consent screen rather than joining here,
 * so nothing is ever shared before the toggles have been seen.
 */
export default function InvitationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const invitations = useGroups((s) => s.invitations);
  const myRequests = useGroups((s) => s.myRequests);
  const refreshInvitations = useGroups((s) => s.refreshInvitations);
  const decline = useGroups((s) => s.declineInvitation);
  const cancelRequest = useGroups((s) => s.cancelRequest);

  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshInvitations();
    }, [refreshInvitations]),
  );

  const onDecline = async (id: string) => {
    setDecliningId(id);
    setError(null);
    try {
      await decline(id);
      haptics.success();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline that invitation.');
    } finally {
      setDecliningId(null);
    }
  };

  const onWithdraw = async (id: string) => {
    setDecliningId(id);
    setError(null);
    try {
      await cancelRequest(id);
      haptics.success();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw that request.');
    } finally {
      setDecliningId(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Invitations" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <ThemedText type="sm" themeColor="dangerText">
            {error}
          </ThemedText>
        ) : null}

        {myRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="micro" themeColor="textTertiary">
              Waiting on a decision
            </ThemedText>
            {myRequests.map((request) => (
              <Card key={request.id} style={styles.requestCard}>
                <View style={styles.requestText}>
                  <ThemedText type="smBold" numberOfLines={1}>
                    {request.group.name}
                  </ThemedText>
                  <ThemedText type="sm" themeColor="textSecondary">
                    {`${CATEGORY_LABEL[request.group.category]} · you asked to join`}
                  </ThemedText>
                </View>
                <Button
                  label="Withdraw"
                  variant="ghost"
                  size="sm"
                  disabled={decliningId === request.id}
                  onPress={() => void onWithdraw(request.id)}
                />
              </Card>
            ))}
          </View>
        ) : null}

        {invitations.length === 0 && myRequests.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSunken }]}>
              <SymbolView
                name={{ ios: 'envelope', android: 'mail' }}
                size={28}
                tintColor={colors.textTertiary}
                fallback={<View />}
              />
            </View>
            <ThemedText type="h3" style={styles.centerText}>
              Nothing waiting
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>
              When someone invites you to a group, it shows up here first — you&apos;ll see
              exactly what you&apos;d share before anything is shared.
            </ThemedText>
          </View>
        ) : null}

        {invitations.length > 0 &&
          invitations.map((invitation) => (
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
      </ScrollView>
    </ThemedView>
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
  section: {
    gap: Spacing.s8,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
  },
  requestText: {
    flex: 1,
    gap: 2,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.s12,
    paddingTop: Spacing.s48,
    paddingHorizontal: Spacing.s12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
});
