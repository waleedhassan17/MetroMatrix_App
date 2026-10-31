// OrderTicket — one order on the kitchen's board: its code and age, the
// time left to answer a new one, who it's for and what's in it, how it's
// paid, and the one move that comes next (Accept, Start cooking, Ready…).
// A new order also offers Decline. Tapping the ticket opens the order.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import {
  PAYMENT_STATUS,
  VENDOR_MOVE_LABEL,
  agoLabel,
  clock,
  nextVendorMove,
  pillTone,
  secondsLeft,
  type VendorMove,
} from '../../models/food/foodStatusModel';
import type { BoardCard } from '../../models/food';
import { originLabel, scheduledLabel } from '../../models/kitchen/boardModel';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { StatusPill } from '../StatusPill';

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    root: {
      gap: space.s8,
      padding: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.border,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    body: { gap: space.s8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s8,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexShrink: 1 },
    actions: { flexDirection: 'row', gap: space.s8 },
    grow: { flex: 1 },
  });

export interface OrderTicketProps {
  card: BoardCard;
  now: number;
  busy?: boolean;
  onOpen: () => void;
  onMove: (move: VendorMove) => void;
  onDecline?: () => void;
  /** The kitchen's note from stock ("Recipe stock low: Karahi, 2 left"). */
  note?: { label: string; tone: 'warning' | 'danger' } | null;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({
  card,
  now,
  busy,
  onOpen,
  onMove,
  onDecline,
  note,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const isNew = card.status === 'placed';
  const left = isNew ? secondsLeft(card.acceptBy, now) : null;
  const move = nextVendorMove(card);
  const pay = PAYMENT_STATUS[card.payment.status];
  // The ticket's body opens the order; its buttons sit beside it, never inside (no nested buttons).
  return (
    <View style={[styles.root, isNew && { borderColor: service.accent }]}>
      <Pressable
        onPress={onOpen}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`Order ${card.code}, ${card.itemsSummary}, ${formatPKR(card.total)}${
          left !== null ? `, ${clock(left)} to answer` : ''
        }${note ? `. ${note.label}` : ''}`}>
        <View style={styles.row}>
          <View style={styles.left}>
            <IonIcon
              name={card.fulfilment === 'pickup' ? 'bag-handle-outline' : 'bicycle-outline'}
              size="md"
              color={colors.inkMuted}
            />
            <AppText variant="title">{card.code}</AppText>
          </View>
          {left !== null ? (
            <AppText variant="label" tone={left < 60 ? 'warning' : 'accentDeep'}>
              {`${clock(left)} to answer`}
            </AppText>
          ) : (
            <AppText variant="caption" tone="muted">
              {agoLabel(card.placedAt, now)}
            </AppText>
          )}
        </View>
        {card.scheduledFor || originLabel(card) ? (
          <View style={styles.left}>
            {card.scheduledFor ? <StatusPill label={scheduledLabel(card.scheduledFor, now, 'Asia/Karachi')} tone="accent" /> : null}
            {originLabel(card) ? <StatusPill label={originLabel(card)!} /> : null}
          </View>
        ) : null}
        <AppText variant="body" numberOfLines={3}>
          {card.itemsSummary}
        </AppText>
        {note ? (
          <View style={styles.left}>
            <IonIcon name={note.tone === 'danger' ? 'alert-circle-outline' : 'trending-down-outline'} size="sm" color={note.tone === 'danger' ? colors.danger : colors.warning} />
            <AppText variant="small" tone={note.tone}>
              {note.label}
            </AppText>
          </View>
        ) : null}
        <View style={styles.row}>
          <AppText variant="small" tone="muted" numberOfLines={1} style={styles.grow}>
            {card.customerName ?? 'Customer'}
          </AppText>
          <AppText variant="bodyStrong">{formatPKR(card.total)}</AppText>
        </View>
        <View style={styles.row}>
          <StatusPill label={pay.vendorLabel} tone={pillTone(pay.tone)} />
          {card.handedToExternal ? (
            <AppText variant="caption" tone="muted">
              With your rider
            </AppText>
          ) : card.riderId && card.status === 'ready' ? (
            <AppText variant="caption" tone="muted">
              Rider on the way
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {move ? (
        <View style={styles.actions}>
          {isNew && onDecline ? (
            <Button
              label="Decline"
              variant="secondary"
              size="sm"
              onPress={onDecline}
              disabled={busy}
            />
          ) : null}
          <View style={styles.grow}>
            <Button
              label={VENDOR_MOVE_LABEL[move]}
              size="sm"
              onPress={() => onMove(move)}
              loading={busy}
              fullWidth
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default OrderTicket;
