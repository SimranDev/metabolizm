import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { expiryLabel, INVITATION_STATE_LABEL, isInvitationLive } from '@/lib/groups';
import { Spacing, useTheme } from '@/theme';
import type { SentInvitationDto } from '@metabolizm/shared';

type Props = {
  invitation: SentInvitationDto;
  onResend: () => void;
  onRevoke: () => void;
  busy?: boolean;
};

/**
 * One invitation this group has sent.
 *
 * Shows the address and nothing else about the person — no name, no avatar,
 * not even once they exist as an account. Rendering identity here would turn
 * "did they accept" into an email → profile lookup for anyone who can make a
 * group, which is why the API doesn't return it either.
 */
export function PendingInviteRow({ invitation, onResend, onRevoke, busy = false }: Props) {
  const { colors } = useTheme();
  const live = isInvitationLive(invitation.state);

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.text}>
        <ThemedText type="sm" numberOfLines={1}>
          {invitation.email}
        </ThemedText>
        <ThemedText type="micro" themeColor="textTertiary">
          {live
            ? `${INVITATION_STATE_LABEL[invitation.state]} · ${expiryLabel(invitation.expiresAt)}`
            : INVITATION_STATE_LABEL[invitation.state]}
        </ThemedText>
      </View>

      {live ? (
        <View style={styles.actions}>
          <Button label="Resend" variant="secondary" size="sm" onPress={onResend} disabled={busy} />
          <Button label="Withdraw" variant="ghost" size="sm" onPress={onRevoke} disabled={busy} />
        </View>
      ) : (
        <Badge
          size="sm"
          variant={invitation.state === 'accepted' ? 'accent' : 'neutral'}
          label={INVITATION_STATE_LABEL[invitation.state]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.s12,
    paddingVertical: Spacing.s12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
});
