// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: one Food Court order (disputes)
// ═══════════════════════════════════════════════════════
// Read-only: where it is, the vendor and the customer to call, how it was
// paid (customers pay the vendor directly), the rider, what was ordered,
// and every event in order — who did what, and when.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { actorLabel } from '../../models/food/adminFoodModel';
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  orderStatusLabel,
  pillTone,
  rejectReasonLabel,
  riderStepLabel,
} from '../../models/food/foodStatusModel';
import { useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Card,
  Divider,
  IconButton,
  InlineNotice,
  ScreenShell,
  SkeletonLines,
  StatusPill,
  TextAction,
} from '../../Custom-Components/index';
import type {
  AdminFoodStackParamList,
  FoodOrderEvent,
  FoodOrderStatus,
  FoodPaymentStatus,
} from '../../models';
import { formatDateTime } from '../../utils/dates/dates';
import { callNumber } from '../../utils/maps/maps';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { loadAdminFoodOrderAsync, selectAdminFoodOrderEntry } from './adminFoodOrderSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodOrder'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s12,
    },
    grow: { flex: 1, gap: space.s4 },
    event: { gap: space.s4, paddingVertical: space.s8 },
  });

/** One event in words. */
const eventText = (e: FoodOrderEvent) => {
  if (e.kind === 'status' && e.to === 'placed') return 'Placed';
  if (e.kind === 'status' && e.to && e.to in ORDER_STATUS)
    return ORDER_STATUS[e.to as FoodOrderStatus].label;
  if (e.kind === 'payment' && e.to && e.to in PAYMENT_STATUS)
    return `Payment: ${PAYMENT_STATUS[e.to as FoodPaymentStatus].vendorLabel}`;
  if (e.kind === 'rider' && e.to) return `Rider: ${riderStepLabel(e.to, 'vendor')}`;
  return e.note ?? e.kind;
};

const AdminFoodOrder: React.FC<Props> = ({ route, navigation }) => {
  const { id, code } = route.params;
  const { back } = useBack({ name: 'AdminFoodOrders' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { order: o, status, error } = useAppSelector(st => selectAdminFoodOrderEntry(st, id));

  useEffect(() => {
    void dispatch(loadAdminFoodOrderAsync(id));
  }, [dispatch, id]);

  if (!o) {
    return (
      <ScreenShell title={code ?? 'Order'} onBack={back}>
        {status === 'failed' ? (
          <InlineNotice message={error.message} />
        ) : (
          <SkeletonLines lines={10} />
        )}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={o.code}
      subtitle={o.vendor.name}
      onBack={back}
      refreshing={status === 'loading'}
      onRefresh={() => void dispatch(loadAdminFoodOrderAsync(id))}>
      <Card>
        <View style={styles.row}>
          <AppText variant="title" style={styles.grow}>
            {orderStatusLabel(o.status, o.fulfilment)}
          </AppText>
          <StatusPill
            label={PAYMENT_STATUS[o.payment.status].vendorLabel}
            tone={pillTone(PAYMENT_STATUS[o.payment.status].tone)}
          />
        </View>
        <AppText variant="small" tone="muted">
          {[
            o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery',
            PAYMENT_METHOD[o.payment.method].label,
            `placed ${formatDateTime(o.placedAt)}`,
          ].join(' · ')}
        </AppText>
        {o.cancelReason ? (
          <AppText variant="small">{`${o.cancelledBy ? `${actorLabel(o.cancelledBy)}: ` : ''}${
            o.status === 'rejected' ? rejectReasonLabel(o.cancelReason) : o.cancelReason
          }`}</AppText>
        ) : null}
        {o.scheduledFor ? (
          <AppText variant="small">{`Scheduled for ${formatDateTime(o.scheduledFor)}`}</AppText>
        ) : null}
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.grow}>
            <AppText variant="label">Vendor</AppText>
            <AppText variant="bodyStrong">{o.vendor.name}</AppText>
            {o.vendor.phone ? (
              <AppText variant="small" tone="muted">
                {formatPkPhoneForDisplay(o.vendor.phone)}
              </AppText>
            ) : null}
          </View>
          {o.vendor.phone ? (
            <IconButton
              icon="call-outline"
              accessibilityLabel={`Call ${o.vendor.name}`}
              onPress={() => callNumber(o.vendor.phone!)}
            />
          ) : null}
        </View>
        <TextAction
          label="Open the vendor"
          icon="storefront-outline"
          onPress={() =>
            navigation.navigate('AdminFoodVendor', { id: o.vendor.id, name: o.vendor.name })
          }
        />
        <Divider />
        <View style={styles.row}>
          <View style={styles.grow}>
            <AppText variant="label">Customer</AppText>
            <AppText variant="bodyStrong">
              {o.customer.name ?? o.address?.fullName ?? 'Customer'}
            </AppText>
            {o.customer.email ? (
              <AppText variant="small" tone="muted">
                {o.customer.email}
              </AppText>
            ) : null}
            {o.customer.phone ? (
              <AppText variant="small" tone="muted">
                {formatPkPhoneForDisplay(o.customer.phone)}
              </AppText>
            ) : null}
            {o.address ? (
              <AppText variant="small" tone="muted">
                {[o.address.line1, o.address.area, o.address.city].filter(Boolean).join(', ')}
              </AppText>
            ) : null}
          </View>
          {o.customer.phone ? (
            <IconButton
              icon="call-outline"
              accessibilityLabel="Call the customer"
              onPress={() => callNumber(o.customer.phone!)}
            />
          ) : null}
        </View>
        {o.rider ? (
          <>
            <Divider />
            <View style={styles.grow}>
              <AppText variant="label">Vendor’s rider</AppText>
              <AppText variant="bodyStrong">{o.rider.name}</AppText>
              <AppText variant="small" tone="muted">
                {[
                  riderStepLabel(o.rider.step, 'vendor'),
                  o.rider.phone ? formatPkPhoneForDisplay(o.rider.phone) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
          </>
        ) : o.handedToExternal ? (
          <AppText variant="small" tone="muted">
            Handed to the vendor’s own rider (no rider account).
          </AppText>
        ) : null}
      </Card>

      <Card>
        {o.items.map(i => (
          <View key={i.id} style={styles.row}>
            <View style={styles.grow}>
              <AppText variant="body">{`${i.quantity} × ${i.name}`}</AppText>
              {i.variant || i.options.length ? (
                <AppText variant="caption" tone="muted">
                  {[i.variant, i.options.map(x => x.name).join(', ')].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
            </View>
            <AppText variant="body">{formatPKR(i.lineTotal)}</AppText>
          </View>
        ))}
        <Divider />
        <View style={styles.row}>
          <AppText variant="small" tone="muted">
            Subtotal
          </AppText>
          <AppText variant="small">{formatPKR(o.totals.subtotal)}</AppText>
        </View>
        {o.totals.discount ? (
          <View style={styles.row}>
            <AppText variant="small" tone="muted">
              {o.deal?.code ? `Code ${o.deal.code}` : o.deal?.title ?? 'Deal'}
            </AppText>
            <AppText variant="small">{`− ${formatPKR(o.totals.discount)}`}</AppText>
          </View>
        ) : null}
        {o.fulfilment === 'delivery' ? (
          <View style={styles.row}>
            <AppText variant="small" tone="muted">
              Delivery (the vendor’s fee)
            </AppText>
            <AppText variant="small">
              {o.totals.deliveryFee ? formatPKR(o.totals.deliveryFee) : 'Free'}
            </AppText>
          </View>
        ) : null}
        <View style={styles.row}>
          <AppText variant="bodyStrong">{`Paid to ${o.vendor.name}`}</AppText>
          <AppText variant="bodyStrong">{formatPKR(o.totals.total)}</AppText>
        </View>
        {o.codCollected !== null ? (
          <AppText variant="small" tone="muted">{`Cash taken: ${formatPKR(
            o.codCollected,
          )}`}</AppText>
        ) : null}
        {o.payment.reference ? (
          <AppText
            variant="small"
            tone="muted">{`Transfer reference: ${o.payment.reference}`}</AppText>
        ) : null}
        {o.payment.rejectedReason ? (
          <AppText
            variant="small"
            tone="muted">{`Receipt not accepted: ${o.payment.rejectedReason}`}</AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="title">What happened</AppText>
        {o.events.map((e, i) => (
          <View key={`${e.at}-${i}`}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.event}>
              <AppText variant="body">{eventText(e)}</AppText>
              <AppText variant="caption" tone="muted">
                {`${actorLabel(e.actorRole)} · ${formatDateTime(e.at)}`}
              </AppText>
              {e.note && e.kind !== 'note' ? (
                <AppText variant="small" tone="muted">
                  {e.note}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </Card>
    </ScreenShell>
  );
};

export default AdminFoodOrder;
