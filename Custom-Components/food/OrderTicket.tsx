// OrderTicket — one order on the kitchen's board: its code and ONE pill
// (ticketHeadline), how long ago it came in or the time left to answer a new
// one (with a bar), who it's for and what's in it, the total, and the one
// move that comes next (Accept, Start cooking, Ready…). A new order also
// offers Decline. Tapping the ticket opens the order. The clock re-renders
// only this ticket, never the whole board.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { useNow } from '../../hooks/useNow';
import { VENDOR_MOVE_LABEL, VENDOR_RIDER_LINE, agoLabel, clock, nextVendorMove, secondsLeft, ticketHeadline, type VendorMove } from '../../models/food/foodStatusModel';
import type { BoardCard } from '../../models/food';
import { originLabel, scheduledLabel } from '../../models/kitchen/boardModel';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { ProgressBar } from '../ProgressBar';
import { StatusPill } from '../StatusPill';

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    // The FYP card; a new order wears the kitchen's colour as its edge.
    root: {
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.hairline,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    fresh: { borderWidth: size.focusBorder },
    body: { gap: space.s8 },
    clock: { gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    left: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexShrink: 1 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.s12, rowGap: space.s4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s8 },
    grow: { flex: 1 },
  });

export interface OrderTicketProps {
  card: BoardCard;
  busy?: boolean;
  onOpen: () => void;
  onMove: (move: VendorMove) => void;
  onDecline?: () => void;
  /** The kitchen's note from stock ("Recipe stock low: Karahi, 2 left"). */
  note?: { label: string; tone: 'warning' | 'danger' } | null;
}

/** The time line: seconds left to answer a new order (with its bar), else how long ago it came in. */
const TicketClock: React.FC<{ card: BoardCard }> = ({ card }) => {
  const styles = useStyles(makeStyles);
  const isNew = card.status === 'placed';
  const now = useNow(isNew ? 1000 : 30_000);
  const left = isNew ? secondsLeft(card.acceptBy, now) : null;
  if (left === null) {
    return (
      <AppText variant="caption" tone="muted">
        {agoLabel(card.placedAt, now)}
      </AppText>
    );
  }
  const window = card.acceptBy ? Math.max(1, (Date.parse(card.acceptBy) - Date.parse(card.placedAt)) / 1000) : 1;
  return (
    <View style={styles.clock} accessibilityLabel={`${clock(left)} to answer`}>
      <AppText variant="label" tone={left < 60 ? 'warning' : 'accentDeep'}>
        {`${clock(left)} to answer`}
      </AppText>
      <ProgressBar progress={Math.min(1, left / window)} />
    </View>
  );
};

export const OrderTicket: React.FC<OrderTicketProps> = ({ card, busy, onOpen, onMove, onDecline, note }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const isNew = card.status === 'placed';
  // "For today, 7:30 PM": a day's resolution is enough for the scheduled line.
  const day = useNow(60_000);
  const move = nextVendorMove(card);
  const pill = ticketHeadline(card);
  const origin = originLabel(card);
  const rider = card.handedToExternal ? VENDOR_RIDER_LINE.withRider : card.riderId && card.status === 'ready' ? VENDOR_RIDER_LINE.riderComing : null;
  // The ticket's body opens the order; its buttons sit beside it, never inside (no nested buttons).
  return (
    <View style={[styles.root, isNew && styles.fresh, isNew && { borderColor: service.accent }]}>
      <Pressable
        onPress={onOpen}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`Order ${card.code}, ${pill.label}, ${card.itemsSummary}, ${formatPKR(card.total)}${note ? `. ${note.label}` : ''}`}>
        <View style={styles.row}>
          <View style={styles.left}>
            <IonIcon name={card.fulfilment === 'pickup' ? 'bag-handle-outline' : 'bicycle-outline'} size="md" color={colors.inkMuted} />
            <AppText variant="title">{card.code}</AppText>
          </View>
          <StatusPill label={pill.label} tone={pill.tone} />
        </View>
        <TicketClock card={card} />
        {card.scheduledFor || origin || rider ? (
          <View style={styles.meta}>
            {card.scheduledFor ? (
              <View style={styles.metaItem}>
                <IonIcon name="calendar-outline" size="sm" color={service.accentDeep} />
                <AppText variant="caption" tone="accentDeep">
                  {scheduledLabel(card.scheduledFor, day, 'Asia/Karachi')}
                </AppText>
              </View>
            ) : null}
            {origin ? (
              <View style={styles.metaItem}>
                <IonIcon name="link-outline" size="sm" color={colors.inkMuted} />
                <AppText variant="caption" tone="muted">
                  {origin}
                </AppText>
              </View>
            ) : null}
            {rider ? (
              <View style={styles.metaItem}>
                <IonIcon name="bicycle-outline" size="sm" color={colors.inkMuted} />
                <AppText variant="caption" tone="muted">
                  {rider}
                </AppText>
              </View>
            ) : null}
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
      </Pressable>
      {move ? (
        <View style={styles.actions}>
          {isNew && onDecline ? (
            <View style={styles.grow}>
              <Button label="Decline" variant="secondary" onPress={onDecline} disabled={busy} fullWidth />
            </View>
          ) : null}
          <View style={styles.grow}>
            <Button label={VENDOR_MOVE_LABEL[move]} onPress={() => onMove(move)} loading={busy} fullWidth />
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default OrderTicket;
