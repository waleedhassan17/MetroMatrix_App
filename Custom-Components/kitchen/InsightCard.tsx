// InsightCard — one finding, why it matters, one thing to do about it.
// A white card like every other: its severity is the tinted icon well, not
// a coloured strip. "Not now" snoozes it for a day.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Card } from '../Card';
import { TextAction } from '../TextAction';
import { ToneWell } from './kitchenShared';
import { cardLook } from '../../models/kitchen/insightCardModel';
import type { InsightCard as InsightCardData } from '../../types/kitchen';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    text: { flex: 1, gap: space.s4 },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12, marginTop: space.s12 },
  });

export const InsightCard: React.FC<{ card: InsightCardData; onAction: () => void; onDismiss: () => void; busy?: boolean }> = ({ card, onAction, onDismiss, busy }) => {
  const styles = useStyles(makeStyles);
  const look = cardLook(card);
  return (
    <Card accessibilityLabel={`${card.title}. ${card.why}`}>
      <View style={styles.row}>
        <ToneWell icon={look.icon} tone={look.tone} />
        <View style={styles.text}>
          <AppText variant="title">{card.title}</AppText>
          <AppText variant="small" tone="muted">
            {card.why}
          </AppText>
        </View>
      </View>
      <View style={styles.foot}>
        <Button label={card.action.label} onPress={onAction} size="sm" variant="secondary" />
        <TextAction label="Not now" tone="muted" onPress={onDismiss} disabled={busy} accessibilityLabel={`Not now: hide “${card.title}” for a day`} />
      </View>
    </Card>
  );
};

export default InsightCard;
