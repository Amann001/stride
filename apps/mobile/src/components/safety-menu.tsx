import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason } from '@repo/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import { OptionSheet } from '@/components/option-sheet';
import { api } from '@/lib/api';

type Action = 'report' | 'block' | 'unblock' | '';

// The "…" menu on a person's profile or in a chat: report them, or block / unblock them.
// `context` says what's being reported (an activity or a message), if anything specific.
export function SafetyMenu({ visible, onClose, athleteId, name, blockedByYou, context, onBlockedChange }: {
  visible: boolean;
  onClose: () => void;
  athleteId: string;
  name: string;
  blockedByYou: boolean;
  context?: { activityId?: string; messageId?: string };
  onBlockedChange?: (blocked: boolean) => void;
}) {
  const [choosingReason, setChoosingReason] = useState(false);

  const act = (action: Action) => {
    if (action === 'report') {
      // Let this sheet finish closing before the next one opens.
      setTimeout(() => setChoosingReason(true), 350);
    } else if (action === 'block') {
      Alert.alert(
        `Block ${name}?`,
        "You'll stop following each other, and neither of you will be able to see, follow, message or comment on the other. They won't be told.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () =>
              api.blockAthlete(athleteId).then(
                () => onBlockedChange?.(true),
                (err) => Alert.alert('Could not block', err instanceof Error ? err.message : 'Please try again.'),
              ),
          },
        ],
      );
    } else if (action === 'unblock') {
      api.unblockAthlete(athleteId).then(
        () => onBlockedChange?.(false),
        (err) => Alert.alert('Could not unblock', err instanceof Error ? err.message : 'Please try again.'),
      );
    }
  };

  const report = (reason: ReportReason) =>
    api.report({ targetUserId: athleteId, reason, ...context }).then(
      () =>
        Alert.alert(
          'Thanks for letting us know',
          blockedByYou
            ? "We'll review your report."
            : `We'll review your report. You can also block ${name} so they can't contact you.`,
        ),
      (err) => Alert.alert('Could not send report', err instanceof Error ? err.message : 'Please try again.'),
    );

  return (
    <>
      <OptionSheet<Action>
        visible={visible}
        title={name}
        value=""
        onClose={onClose}
        onSelect={act}
        options={[
          { value: 'report', label: 'Report', description: 'Spam, harassment or something inappropriate' },
          blockedByYou
            ? { value: 'unblock', label: `Unblock ${name}` }
            : { value: 'block', label: `Block ${name}`, description: "They won't be able to see or contact you" },
        ]}
      />
      <OptionSheet<ReportReason | ''>
        visible={choosingReason}
        title={`Why are you reporting ${name}?`}
        value=""
        onClose={() => setChoosingReason(false)}
        onSelect={(reason) => reason && report(reason)}
        options={REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABELS[r] }))}
      />
    </>
  );
}
