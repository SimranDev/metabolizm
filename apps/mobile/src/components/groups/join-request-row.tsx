import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/groups/avatar';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { shareSummary } from '@/lib/groups';
import { Spacing } from '@/theme';
import type { GroupJoinRequestDto } from '@metabolizm/shared';

type Props = {
  request: GroupJoinRequestDto;
  onApprove: () => void;
  onDecline: () => void;
  busy?: boolean;
};

/**
 * Someone asking to join, as the approver sees them.
 *
 * The share chips are the point of the row: approving admits a person AND
 * starts receiving what they chose to share, so the decision is made with that
 * in front of you. The server resolves `shareConfig` exactly as approval will
 * apply it, so what's shown here is what the membership gets.
 */
export function JoinRequestRow({ request, onApprove, onDecline, busy = false }: Props) {
  const chips = shareSummary(request.shareConfig);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Avatar name={request.name} image={request.image} size={36} />
        <View style={styles.identity}>
          <ThemedText type="smBold" numberOfLines={1}>
            {request.name}
          </ThemedText>
          <ThemedText type="sm" themeColor="textTertiary">
            Asked to join
          </ThemedText>
        </View>
      </View>

      <View style={styles.chips}>
        {chips.length > 0 ? (
          chips.map((chip) => <Badge key={chip} size="sm" variant="neutral" label={chip} />)
        ) : (
          <ThemedText type="sm" themeColor="textTertiary">
            They&apos;d share nothing but whether they logged.
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        <Button label="Approve" onPress={onApprove} disabled={busy} fullWidth />
        <Button
          label="Decline"
          variant="ghost"
          onPress={onDecline}
          disabled={busy}
          fullWidth
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.s12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s12,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s8,
  },
  actions: {
    gap: Spacing.s8,
  },
});
