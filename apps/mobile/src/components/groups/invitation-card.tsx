import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/groups/avatar';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CATEGORY_LABEL, expiryLabel } from '@/lib/groups';
import { Radius, Spacing, useTheme } from '@/theme';
import type { ReceivedInvitationDto } from '@metabolizm/shared';

type Props = {
  invitation: ReceivedInvitationDto;
  /** Opens the consent screen. Never joins directly — see the note below. */
  onReview: () => void;
  onDecline: () => void;
  declining?: boolean;
};

/**
 * One invitation waiting for me.
 *
 * The primary action is "Review" rather than "Accept", and that is deliberate:
 * joining a group starts sharing data, so the consent screen has to be seen
 * first. Accepting straight off this card would be the one place in the
 * feature where someone shares something they were never shown.
 *
 * Unlike every other Groups surface this card is unmasked, because there is
 * nothing here to mask — a group name, its size, and the name of whoever sent
 * it, all disclosed by the sender in the act of inviting.
 */
export function InvitationCard({ invitation, onReview, onDecline, declining = false }: Props) {
  const { colors } = useTheme();
  const { group, invitedBy } = invitation;

  return (
    <Card style={[styles.card, { borderColor: colors.focusRing }]}>
      <View style={styles.head}>
        <Avatar name={invitedBy.name} image={invitedBy.image} size={40} />
        <View style={styles.headText}>
          <ThemedText type="h3" numberOfLines={1}>
            {group.name}
          </ThemedText>
          <ThemedText type="sm" themeColor="textSecondary" numberOfLines={1}>
            {`${invitedBy.name} invited you`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.badges}>
        <Badge size="sm" variant="outline" label={CATEGORY_LABEL[group.category]} />
        <Badge
          size="sm"
          variant="neutral"
          label={`${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`}
        />
      </View>

      <View style={styles.meta}>
        <SymbolView
          name={{ ios: 'clock', android: 'schedule' }}
          size={13}
          tintColor={colors.textTertiary}
          fallback={<View />}
        />
        <ThemedText type="micro" themeColor="textTertiary">
          {expiryLabel(invitation.expiresAt)}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button label="Review invite" onPress={onReview} fullWidth />
        <Button
          label={declining ? 'Declining…' : 'Decline'}
          variant="ghost"
          onPress={onDecline}
          disabled={declining}
          fullWidth
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.s12,
    borderRadius: Radius.lg,
    // 2px accent border: an invitation is the one card on the tab that is
    // waiting on the user, and the system marks that with the focus ring.
    borderWidth: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.s8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s4,
  },
  actions: {
    gap: Spacing.s8,
    marginTop: Spacing.s4,
  },
});
