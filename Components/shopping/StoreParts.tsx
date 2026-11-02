// ═══════════════════════════════════════════════════════
// MetroMatrix — Store partner screen parts
// ═══════════════════════════════════════════════════════
// An order in the store's lists (a raised card, the FYP's: the customer's
// initials, the code and day, ONE status pill, the items and payment in a
// ruled foot with the total) and the same order as a plain line inside a
// card (Today's newest orders).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Avatar, StatusPill } from '../../Custom-Components/index';
import { PAYMENT_METHOD_LABEL, partnerHeadline } from '../../models/shopping/orderStatusModel';
import { RowCard } from '../admin/AdminParts';
import type { PartnerOrderRow } from '../../models';
import { formatDay } from '../../utils/dates/dates';
import { formatPKR } from '../../utils/money/money';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    orderLine: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    orderText: { flex: 1, gap: space.s4 },
    orderEnd: { alignItems: 'flex-end', gap: space.s4 },
  });

const itemsLine = (o: PartnerOrderRow) => `${o.itemCount} ${o.itemCount === 1 ? 'item' : 'items'} · ${PAYMENT_METHOD_LABEL[o.paymentMethod]}`;

/** One order in the store's list: a raised card with ONE pill (a transfer to check comes first). */
export const PartnerOrderCard: React.FC<{ order: PartnerOrderRow; onPress: () => void }> = ({ order, onPress }) => {
  const head = partnerHeadline(order);
  return (
    <RowCard
      mark={{ name: order.customerFirstName || order.code }}
      title={order.customerFirstName || 'Customer'}
      lines={[`${order.code} · ${formatDay(order.createdAt)}`]}
      pill={{ label: head.label, tone: head.tone }}
      foot={{ left: itemsLine(order), right: formatPKR(order.total) }}
      onPress={onPress}
    />
  );
};

/** The same order as a line inside a card (Today's newest orders). */
export const PartnerOrderLine: React.FC<{ order: PartnerOrderRow; onPress: () => void }> = ({ order, onPress }) => {
  const styles = useStyles(makeStyles);
  const { opacity } = useTheme();
  const head = partnerHeadline(order);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${order.customerFirstName}, ${order.code}, ${formatPKR(order.total)}, ${head.label}`}
      style={({ pressed }) => [styles.orderLine, pressed && { opacity: opacity.pressed }]}>
      <Avatar name={order.customerFirstName || order.code} size="md" />
      <View style={styles.orderText}>
        <AppText variant="title" numberOfLines={1}>
          {order.customerFirstName || 'Customer'}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {order.code} · {formatDay(order.createdAt)}
        </AppText>
      </View>
      <View style={styles.orderEnd}>
        <AppText variant="bodyStrong">{formatPKR(order.total)}</AppText>
        <StatusPill label={head.label} tone={head.tone} />
      </View>
    </Pressable>
  );
};
