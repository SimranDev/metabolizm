import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { groupsApi } from '@/lib/api';
import { inviteLink } from '@/lib/groups';
import { haptics } from '@/lib/haptics';
import { Radius, Spacing, useTheme } from '@/theme';

/**
 * Add someone to a group.
 *
 * Email is the primary path: it reaches the person inside the app, where they
 * see the consent screen before anything is shared. The share link stays as
 * the secondary path because it is the only way to reach someone who has no
 * account yet — the API answers an unknown address with a plain 404 rather
 * than pretending an invitation went somewhere.
 */
export default function InviteMemberScreen() {
  const { groupId, groupName } = useLocalSearchParams<{
    groupId: string;
    groupName?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const send = async () => {
    const address = email.trim();
    if (!address || sending) return;
    setSending(true);
    setError(null);
    try {
      const { invitation } = await groupsApi.createInvitation(groupId, address);
      haptics.success();
      setSentTo(invitation.email);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that invitation.');
    } finally {
      setSending(false);
    }
  };

  const shareLink = async () => {
    try {
      const { invite } = await groupsApi.createInvite(groupId, {
        ttlHours: 168,
        requiresApproval,
      });
      await Share.share({
        message: `Join me on Metabolizm${groupName ? ` — ${groupName}` : ''}: ${inviteLink(invite.token)}`,
      });
    } catch {
      // A dismissed share sheet isn't an error worth reporting.
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Invite someone" subtitle={groupName} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText type="body" themeColor="textSecondary">
            Invite them with the email they signed up with. It arrives in their app, and they
            choose what to share before they join.
          </ThemedText>

          <Input
            label="Email address"
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (error) setError(null);
            }}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
          />

          {error ? (
            <ThemedText type="sm" themeColor="dangerText">
              {error}
            </ThemedText>
          ) : null}

          {sentTo ? (
            <View style={styles.sent}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
                size={16}
                tintColor={colors.successText}
                fallback={<View />}
              />
              <ThemedText type="sm" themeColor="successText" style={styles.sentText}>
                {`Invitation sent to ${sentTo}. They'll see it in Groups.`}
              </ThemedText>
            </View>
          ) : null}

          <Button
            label={sending ? 'Sending…' : 'Send invitation'}
            onPress={() => void send()}
            disabled={sending || email.trim().length === 0}
            fullWidth
            size="lg"
          />

          <Card style={[styles.linkCard, { borderColor: colors.borderStrong }]}>
            <ThemedText type="smBold">No account yet?</ThemedText>
            <ThemedText type="sm" themeColor="textSecondary">
              {requiresApproval
                ? 'Send them a link. Opening it asks to join, and nobody is in until you say yes.'
                : 'Send them a link instead. Anyone who opens it can join, so share it only with people you mean to add.'}
            </ThemedText>

            <View style={styles.approvalRow}>
              <View style={styles.approvalText}>
                <ThemedText type="smBold">Review before they join</ThemedText>
                <ThemedText type="sm" themeColor="textTertiary">
                  A link can be forwarded. This makes it a request you approve.
                </ThemedText>
              </View>
              <Switch
                value={requiresApproval}
                onValueChange={(next) => {
                  haptics.select();
                  setRequiresApproval(next);
                }}
                accessibilityLabel="Review before they join"
                trackColor={{ true: colors.actionPrimary, false: colors.ringTrack }}
                thumbColor={colors.surface}
              />
            </View>

            <Button
              label="Share an invite link"
              variant="secondary"
              onPress={() => void shareLink()}
              fullWidth
            />
          </Card>

          <Button
            label="See pending invitations"
            variant="ghost"
            onPress={() =>
              router.push({ pathname: '/group-invites', params: { groupId, groupName } })
            }
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.s20,
    paddingBottom: Spacing.s48,
    gap: Spacing.s16,
  },
  sent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.s8,
  },
  sentText: {
    flex: 1,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
  },
  approvalText: {
    flex: 1,
    gap: 2,
  },
  linkCard: {
    gap: Spacing.s12,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    marginTop: Spacing.s8,
  },
});
