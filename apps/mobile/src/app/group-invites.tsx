import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { JoinRequestRow } from '@/components/groups/join-request-row';
import { PendingInviteRow } from '@/components/groups/pending-invite-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useRequest } from '@/hooks/use-request';
import { groupsApi } from '@/lib/api';
import { isInvitationLive } from '@/lib/groups';
import { haptics } from '@/lib/haptics';
import { Spacing } from '@/theme';

/**
 * Invitations this group has sent — the other half of inviting by email.
 *
 * A separate route rather than a fourth tab on the group screen: that tab set
 * is already role-conditional and at three items, and this is a thing you do
 * once after inviting, not something you come back to daily.
 */
export default function GroupInvitesScreen() {
  const { groupId, groupName } = useLocalSearchParams<{
    groupId: string;
    groupName?: string;
  }>();

  // Both lists in one request: they're the two halves of "who's trying to get
  // in", and fetching them separately would let the screen show one and not
  // the other. A failing requests call must not blank the invitations, so it
  // degrades to an empty list rather than rejecting the pair.
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [invitations, requests] = await Promise.all([
        groupsApi.listGroupInvitations(groupId, { signal }),
        groupsApi.listJoinRequests(groupId, { signal }).catch(() => ({ requests: [] })),
      ]);
      return { ...invitations, ...requests };
    },
    [groupId],
  );
  const { data, loading, error, reload } = useRequest(load);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await run();
      haptics.success();
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusyId(null);
    }
  };

  const invitations = data?.invitations ?? [];
  const requests = data?.requests ?? [];
  const live = invitations.filter((i) => isInvitationLive(i.state));
  const past = invitations.filter((i) => !isInvitationLive(i.state));

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Invitations" subtitle={groupName} />

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? (
            <ThemedText type="sm" themeColor="dangerText">
              {error}
            </ThemedText>
          ) : null}
          {actionError ? (
            <ThemedText type="sm" themeColor="dangerText">
              {actionError}
            </ThemedText>
          ) : null}

          {/* Requests first: somebody is waiting on a decision, whereas an
              invitation is waiting on someone else. */}
          {requests.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="micro" themeColor="textTertiary">
                {`Asking to join · ${requests.length}`}
              </ThemedText>
              {requests.map((request) => (
                <JoinRequestRow
                  key={request.id}
                  request={request}
                  busy={busyId === request.id}
                  onApprove={() =>
                    void act(request.id, () =>
                      groupsApi.approveJoinRequest(groupId, request.id),
                    )
                  }
                  onDecline={() =>
                    void act(request.id, () =>
                      groupsApi.declineJoinRequest(groupId, request.id),
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          {invitations.length === 0 && requests.length === 0 ? (
            <ThemedText type="body" themeColor="textSecondary">
              No invitations sent yet. Invite someone by their email and they&apos;ll show up
              here until they accept.
            </ThemedText>
          ) : null}

          {live.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="micro" themeColor="textTertiary">
                Waiting
              </ThemedText>
              {live.map((invitation) => (
                <PendingInviteRow
                  key={invitation.id}
                  invitation={invitation}
                  busy={busyId === invitation.id}
                  onResend={() =>
                    void act(invitation.id, () =>
                      groupsApi.createInvitation(groupId, invitation.email),
                    )
                  }
                  onRevoke={() =>
                    void act(invitation.id, () =>
                      groupsApi.revokeInvite(groupId, invitation.id),
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          {past.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="micro" themeColor="textTertiary">
                Earlier
              </ThemedText>
              {past.map((invitation) => (
                <PendingInviteRow
                  key={invitation.id}
                  invitation={invitation}
                  busy={busyId === invitation.id}
                  onResend={() => {}}
                  onRevoke={() => {}}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
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
    gap: Spacing.s24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.s4,
  },
});
