import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { ShareToggles } from '@/components/groups/share-toggles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequest } from '@/hooks/use-request';
import { groupsApi } from '@/lib/api';
import { CATEGORY_LABEL, parseInviteToken, shareConfigDiff } from '@/lib/groups';
import { haptics } from '@/lib/haptics';
import { useGroups } from '@/store/groups';
import { Spacing } from '@/theme';
import type { GroupCategory, GroupShareConfig } from '@metabolizm/shared';

/**
 * Join by invite — the consent screen.
 *
 * Nothing is joined until the toggles have been seen: the server's preview
 * says what the category would share, the user can turn any of it off, and
 * only the toggles they actually changed are sent (the server merges a patch,
 * so a full object would clobber defaults they never touched).
 *
 * Two ways in, one screen. A shared LINK arrives as a token the user pastes;
 * a personal INVITATION arrives as an id from the inbox, and is fetched and
 * accepted by that id because its token never leaves the server — that is
 * what stops a targeted invitation being forwarded to a stranger.
 */
type Source =
  | { kind: 'token'; token: string }
  | { kind: 'invitation'; invitationId: string };

/** Both invite shapes, normalized. `invitedBy` is null for an open link. */
type Preview = {
  group: { name: string; category: GroupCategory; memberCount: number };
  shareDefaults: GroupShareConfig;
  invitedBy: string | null;
  /** Link only: this group reviews requests, so the action is Request. */
  requiresApproval: boolean;
};

export default function JoinGroupScreen() {
  const { token: tokenParam, invitationId } = useLocalSearchParams<{
    token?: string;
    invitationId?: string;
  }>();
  const [token, setToken] = useState(tokenParam ?? '');

  const source: Source | null = invitationId
    ? { kind: 'invitation', invitationId }
    : token
      ? { kind: 'token', token }
      : null;

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Join a group" dismissLabel="Cancel" />
      {source ? (
        <ConsentView source={source} onReset={() => setToken('')} />
      ) : (
        <TokenEntry onSubmit={setToken} />
      )}
    </ThemedView>
  );
}

function TokenEntry({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = parseInviteToken(value);
    if (!parsed) {
      setError("That doesn't look like an invite link or code.");
      return;
    }
    setError(null);
    onSubmit(parsed);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="body" themeColor="textSecondary">
        Paste the invite link or code you were sent. You&apos;ll see exactly what the group
        would see before you join.
      </ThemedText>

      <Input
        label="Invite link or code"
        value={value}
        onChangeText={setValue}
        placeholder="mtbz.app/g/8KF2-QN"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      {error ? (
        <ThemedText type="sm" themeColor="dangerText">
          {error}
        </ThemedText>
      ) : null}

      <Button label="Continue" onPress={submit} disabled={value.trim().length === 0} fullWidth size="lg" />
    </ScrollView>
  );
}

function ConsentView({ source, onReset }: { source: Source; onReset: () => void }) {
  const router = useRouter();
  const acceptInvite = useGroups((s) => s.acceptInvite);
  const acceptInvitation = useGroups((s) => s.acceptInvitation);
  const declineInvitation = useGroups((s) => s.declineInvitation);
  const requestToJoin = useGroups((s) => s.requestToJoin);

  // Both endpoints are normalized to the same shape here, so everything below
  // renders one consent screen rather than two that could drift apart.
  const load = useCallback(
    async (signal: AbortSignal): Promise<Preview> => {
      if (source.kind === 'invitation') {
        const { invitation } = await groupsApi.getMyInvitation(source.invitationId, { signal });
        return {
          group: invitation.group,
          shareDefaults: invitation.shareDefaults,
          invitedBy: invitation.invitedBy.name,
          // A personal invitation is already a decision about this person, so
          // it is never approval-gated — the server's CHECK guarantees it.
          requiresApproval: false,
        };
      }
      const preview = await groupsApi.previewInvite(source.token, { signal });
      return {
        group: preview.group,
        shareDefaults: preview.shareDefaults,
        invitedBy: null,
        requiresApproval: preview.requiresApproval,
      };
    },
    [source],
  );
  const { data, loading, error } = useRequest(load);

  // Derived rather than seeded in an effect: the toggles show the server's
  // defaults until the user changes something, and only then their override.
  const [override, setOverride] = useState<GroupShareConfig | null>(null);
  const config = override ?? data?.shareDefaults ?? null;

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const join = async () => {
    if (!data || !config || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const patch = shareConfigDiff(data.shareDefaults, config);

      // An approval-gated link produces a request, not a membership — there
      // is no group to navigate to, so the screen reports back instead.
      if (data.requiresApproval) {
        await requestToJoin(source.kind === 'token' ? source.token : '', patch);
        haptics.success();
        setRequested(true);
        setJoining(false);
        return;
      }

      const group =
        source.kind === 'invitation'
          ? await acceptInvitation(source.invitationId, patch)
          : await acceptInvite(source.token, patch);
      haptics.success();
      router.replace({ pathname: '/group/[id]', params: { id: group.id } });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join this group.');
      setJoining(false);
    }
  };

  const decline = async () => {
    if (source.kind !== 'invitation' || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      await declineInvitation(source.invitationId);
      router.back();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not decline this invitation.');
      setJoining(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data || !config) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="body" themeColor="dangerText">
          {error ?? 'This invite is no longer valid.'}
        </ThemedText>
        {source.kind === 'token' ? (
          <Button label="Try another code" variant="secondary" onPress={onReset} fullWidth />
        ) : (
          <Button label="Back" variant="secondary" onPress={() => router.back()} fullWidth />
        )}
      </ScrollView>
    );
  }

  // Asked and waiting. Deliberately not a navigation: there is no membership
  // to open, and dropping someone into a group they haven't been let into yet
  // would be the one screen in the feature that lies about what happened.
  if (requested) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="h2">{`Asked to join ${data.group.name}`}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Someone who runs the group has to say yes. Nothing is shared until they do —
          you&apos;ll find the request waiting under Groups, and you can withdraw it there.
        </ThemedText>
        <Button label="Done" onPress={() => router.back()} fullWidth size="lg" />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <ThemedText type="h2">
          {data.invitedBy
            ? `${data.invitedBy} invited you to ${data.group.name}`
            : data.requiresApproval
              ? `Ask to join ${data.group.name}`
              : `You've been invited to ${data.group.name}`}
        </ThemedText>
        <View style={styles.badges}>
          <Badge size="sm" variant="outline" label={CATEGORY_LABEL[data.group.category]} />
          <Badge
            size="sm"
            variant="neutral"
            label={`${data.group.memberCount} ${data.group.memberCount === 1 ? 'member' : 'members'}`}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="micro" themeColor="textTertiary">
          This group will see
        </ThemedText>
        <ShareToggles value={config} onChange={setOverride} />
      </View>

      <ThemedText type="sm" themeColor="textTertiary">
        Anything switched off shows as &quot;not shared&quot; — never a gap. You can change
        any of this later, per group, and it applies to past days too.
      </ThemedText>

      {joinError ? (
        <ThemedText type="sm" themeColor="dangerText">
          {joinError}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={
            data.requiresApproval
              ? joining
                ? 'Sending…'
                : 'Request to join'
              : joining
                ? 'Joining…'
                : 'Join group'
          }
          onPress={() => void join()}
          disabled={joining}
          fullWidth
          size="lg"
        />
        {source.kind === 'invitation' ? (
          // Declining is a decision the sender sees, so it's offered here
          // rather than left to backing out — which means "not yet".
          <Button
            label="Decline"
            variant="ghost"
            onPress={() => void decline()}
            disabled={joining}
            fullWidth
          />
        ) : (
          <Button label="Not now" variant="ghost" onPress={() => router.back()} fullWidth />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.s20,
    paddingBottom: Spacing.s48,
    gap: Spacing.s20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    gap: Spacing.s8,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.s8,
  },
  section: {
    gap: Spacing.s12,
  },
  actions: {
    gap: Spacing.s8,
  },
});
