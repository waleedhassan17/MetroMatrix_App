// ═══════════════════════════════════════════════════════
// MetroMatrix — Store partner screen parts
// ═══════════════════════════════════════════════════════

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, IonIcon, StatusPill, type IonName } from '../../Custom-Components/index';
import { ORDER_STATUS, PAYMENT_STATUS } from '../../models/shopping/orderStatusModel';
import type { PartnerOrderRow } from '../../models';
import { formatDay } from '../../utils/dates/dates';
import { formatPKR } from '../../utils/money/money';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { paddingVertical: space.s16, gap: space.s8 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    pills: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    tile: {
      flex: 1,
      minHeight: size.control.lg * 2,
      padding: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      gap: space.s8,
      justifyContent: 'space-between',
    },
    tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    well: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  });

/** One order in the store's list. A transfer to check is called out. */
export const PartnerOrderRowView: React.FC<{ order: PartnerOrderRow; onPress: () => void }> = ({ order, onPress }) => {
  const styles = useStyles(makeStyles);
  const { opacity } = useTheme();
  const status = ORDER_STATUS[order.status];
  const pay = PAYMENT_STATUS[order.paymentStatus];
  const check = order.paymentStatus === 'proof_submitted' && order.status !== 'cancelled';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${order.code}, ${order.customerFirstName}, ${formatPKR(order.total)}, ${status.label}${check ? ', payment to check' : ''}`}>
      <View style={styles.line}>
        <AppText variant="title">{order.code}</AppText>
        <AppText variant="title">{formatPKR(order.total)}</AppText>
      </View>
      <AppText variant="small" tone="muted">
        {order.customerFirstName} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {formatDay(order.createdAt)}
      </AppText>
      <View style={styles.pills}>
        <StatusPill label={status.label} tone={status.tone} />
        {check ? <StatusPill label="Check payment" tone="warning" /> : <StatusPill label={pay.label} tone={pay.tone} />}
      </View>
    </Pressable>
  );
};

/** A count the store acts on (Today): tap to see those. */
export const ActionTile: React.FC<{ label: string; count: number; icon: IonName; onPress: () => void; tone?: 'accent' | 'warning' }> = ({
  label,
  count,
  icon,
  onPress,
  tone = 'accent',
}) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  const hot = count > 0;
  const fg = tone === 'warning' ? colors.warning : service.accentDeep;
  const bg = tone === 'warning' ? colors.warningSoft : service.accentSoft;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, hot && { borderColor: tone === 'warning' ? colors.warning : service.accentLine }, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count}`}>
      <View style={styles.tileHead}>
        <View style={[styles.well, { backgroundColor: hot ? bg : colors.surfaceSunk }]}>
          <IonIcon name={icon} size="md" color={hot ? fg : colors.inkMuted} />
        </View>
        <AppText variant="h1" style={{ color: hot ? fg : colors.inkFaint }}>
          {count}
        </AppText>
      </View>
      <AppText variant="small" tone={hot ? 'ink' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
};
