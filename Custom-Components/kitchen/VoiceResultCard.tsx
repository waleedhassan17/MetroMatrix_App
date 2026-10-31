// VoiceResultCard — what was heard, and the one thing it would do.
// The transcript as said (Urdu script right to left), the action in plain
// words, anything to check, and Confirm / Edit / Try again. Unsure results
// lead with "Did you mean…". Nothing happens until Confirm.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Card } from '../Card';
import { TextAction } from '../TextAction';
import { ContentText, ToneWell } from './kitchenShared';
import { actionTitle, actionWarnings, isUnsure } from '../../models/kitchen/voiceModel';
import type { VoiceAction, VoiceResult } from '../../models/kitchen';

export interface VoiceResultCardProps {
  result: VoiceResult;
  onConfirm: (action: VoiceAction) => void;
  /** Opens the form filled in from the action, to change it first. */
  onEdit?: (action: VoiceAction) => void;
  onRetry: () => void;
  onDiscard: () => void;
  busy?: boolean;
  /** "Dummy API: a sample phrase stands in for your recording." */
  note?: string | null;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    text: { flex: 1, gap: space.s4 },
    body: { gap: space.s12 },
    actions: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    alt: { gap: space.s8 },
    foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });

export const VoiceResultCard: React.FC<VoiceResultCardProps> = ({ result, onConfirm, onEdit, onRetry, onDiscard, busy, note }) => {
  const styles = useStyles(makeStyles);
  const unsure = isUnsure(result);
  const action = result.action;
  const warnings = action ? actionWarnings(action) : [];
  return (
    <Card>
      <View style={styles.body} accessibilityLiveRegion="polite">
        <View style={styles.head}>
          <ToneWell icon="mic-outline" tone={action && !unsure ? 'accent' : 'warning'} />
          <View style={styles.text}>
            <AppText variant="overline" tone="muted">
              {result.heard === 'audio' ? 'You said' : 'You typed'}
            </AppText>
            <ContentText variant="body">{result.transcript || 'Nothing we could make out'}</ContentText>
          </View>
        </View>

        {action ? (
          <AppText variant="title" accessibilityRole="header">
            {unsure ? `Did you mean: ${actionTitle(action)}?` : actionTitle(action)}
          </AppText>
        ) : (
          <AppText variant="body" tone="muted">
            We couldn’t turn that into an action. Try again, or fill the form by hand.
          </AppText>
        )}
        {warnings.map(w => (
          <AppText key={w} variant="small" tone="warning">
            {w}
          </AppText>
        ))}

        {unsure && result.alternatives.length ? (
          <View style={styles.alt}>
            <AppText variant="small" tone="muted">
              Or one of these:
            </AppText>
            {result.alternatives.map(a => (
              <TextAction key={a.transcript} label={actionTitle(a.action)} onPress={() => onConfirm(a.action)} disabled={busy} />
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          {action ? <Button label="Confirm" onPress={() => onConfirm(action)} loading={busy} size="sm" leftIcon="checkmark" /> : null}
          {action && onEdit ? <Button label="Edit" variant="secondary" onPress={() => onEdit(action)} disabled={busy} size="sm" /> : null}
          <Button label="Try again" variant="ghost" onPress={onRetry} disabled={busy} size="sm" leftIcon="mic-outline" />
        </View>
        <View style={styles.foot}>
          {note ? (
            <AppText variant="caption" tone="faint" style={styles.text}>
              {note}
            </AppText>
          ) : (
            <View />
          )}
          <TextAction label="Discard" tone="muted" onPress={onDiscard} disabled={busy} />
        </View>
      </View>
    </Card>
  );
};

export default VoiceResultCard;
