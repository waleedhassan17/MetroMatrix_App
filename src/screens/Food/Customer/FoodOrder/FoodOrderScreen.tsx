// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: your order, live
// ═══════════════════════════════════════════════════════
// Where the order is (the steps, the minutes left), the map with the
// kitchen, your address and the kitchen's own rider moving, the rider to
// call, how it's paid (a transfer's account and the receipt), what you
// ordered, and what you can do now: cancel before the kitchen answers, or
// order it again. Live over the socket; read again after reconnects, and
// every few seconds while the connection is down.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useNow } from '@hooks/useNow';
import { useOrderChannel } from '@hooks/useFoodLive';
import {
  CUSTOMER_CANCEL_REASONS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PROGRESS,
  clock,
  isEnded,
  isNegativeEnd,
  orderStatusLabel,
  pillTone,
  progressIndex,
  rejectReasonLabel,
  riderStepLabel,
  secondsLeft,
} from '@models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, IconButton, InlineNotice, IonIcon, ScreenShell, Sheet, SkeletonLines, StatusPill, StatusTimeline, TextAction, type TimelineStep } from '@custom/index';
import { ChoiceLine } from '@custom/food/ChoiceLine';
import { TransferCard } from '@custom/food/TransferCard';
import { FoodMap } from '@custom/food/map/FoodMap';
import type { FoodAppParamList, FoodOrder } from '@/types';
import { cdn } from '@utils/cdn';
import { formatSlot } from '@utils/healthTime';
import { callNumber } from '@utils/maps';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { reorderFoodAsync } from '../FoodBag/foodBagSlice';
import { cancelFoodOrderAsync, foodOrderChanged, foodRiderMoved, loadFoodOrderAsync, selectFoodOrderEntry, selectFoodOrderUi, setCancelSheet } from './foodOrderSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodOrder'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s16 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    logo: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    map: { borderRadius: radius.lg, overflow: 'hidden' },
    riderBadge: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    actions: { gap: space.s8 },
  });

const FoodOrderScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodOrderContent {...props} />
  </ServiceScope>
);

/** The steps, with where the order is now (a negative end stops them). */
const stepsOf = (o: FoodOrder): TimelineStep[] => {
  const steps = PROGRESS[o.fulfilment];
  const at = progressIndex(o.status, o.fulfilment);
  const ended = isNegativeEnd(o.status);
  return steps.map((s, i) => ({
    label: s.label,
    state: ended ? (i <= at ? 'done' : i === at + 1 ? 'failed' : 'upcoming') : i < at || (i === at && isEnded(o.status)) ? 'done' : i === at ? 'current' : 'upcoming',
    description: ended && i === at + 1 ? orderStatusLabel(o.status, o.fulfilment) : undefined,
  }));
};

const FoodOrderContent: React.FC<Props> = ({ route, navigation }) => {
  const { code } = route.params;
  const { back } = useBack({ name: 'FoodTabs', params: { screen: 'FoodOrdersTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
  const { order: o, tracking, status, error } = useAppSelector(st => selectFoodOrderEntry(st, code));
  const ui = useAppSelector(selectFoodOrderUi);
  const now = useNow(1000);

  const refetch = useCallback(() => void dispatch(loadFoodOrderAsync(code)), [dispatch, code]);
  useEffect(() => {
    refetch();
  }, [refetch]);

  const live = !!o && !isEnded(o.status);
  const channel = useOrderChannel(live ? o.id : null, {
    onOrder: next => dispatch(foodOrderChanged(next)),
    onRiderFix: fix => dispatch(foodRiderMoved({ code, fix })),
    refetch,
  });

  if (!o) {
    return (
      <ScreenShell title="Your order" subtitle={code} onBack={back} scroll>
        {status === 'failed' ? <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: refetch }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const label = orderStatusLabel(o.status, o.fulfilment);
  const answerIn = o.status === 'placed' ? secondsLeft(o.acceptBy, now) : null;
  const minutesLeft = tracking?.eta.minutesLeft ?? (o.eta.promisedAt ? Math.max(0, Math.ceil((Date.parse(o.eta.promisedAt) - now) / 60_000)) : null);
  const headline = isNegativeEnd(o.status)
    ? o.cancelReason
      ? o.status === 'rejected'
        ? rejectReasonLabel(o.cancelReason)
        : o.cancelReason
      : null
    : o.status === 'placed'
      ? answerIn
        ? `${o.vendor.name} has ${clock(answerIn)} to accept`
        : `${o.vendor.name} is about to answer`
      : o.scheduledFor && !isEnded(o.status)
        ? `${o.fulfilment === 'pickup' ? 'Ready to collect' : 'Arrives'} at ${formatSlot(o.scheduledFor, TZ)}`
        : live && minutesLeft !== null
          ? `${o.fulfilment === 'pickup' ? 'Ready in' : 'Arrives in'} about ${minutesLeft} min`
          : o.timestamps.deliveredAt
            ? `Delivered at ${formatSlot(o.timestamps.deliveredAt, TZ)}`
            : o.timestamps.pickedUpAt && o.status === 'picked_up'
              ? `Collected at ${formatSlot(o.timestamps.pickedUpAt, TZ)}`
              : null;

  // The map: once accepted, for a delivery with both ends pinned.
  const kitchen = tracking && tracking.branch.lat !== null && tracking.branch.lng !== null ? { lat: tracking.branch.lat, lng: tracking.branch.lng } : null;
  const showMap = live && o.fulfilment === 'delivery' && o.status !== 'placed' && !!kitchen && !!tracking?.drop;
  const rider = tracking?.rider ?? o.rider;
  const riderAt = rider?.lastPosition && (o.status === 'on_the_way' || rider.step !== 'assigned') ? rider.lastPosition : null;

  const reorder = async () => {
    const r = await dispatch(reorderFoodAsync(code));
    if (reorderFoodAsync.fulfilled.match(r)) {
      const { dropped, priceChanges } = r.payload;
      Toast.show({
        type: dropped ? 'info' : 'success',
        text1: r.payload.cart.empty ? 'None of those dishes can be ordered now' : 'Back in your bag',
        text2: dropped ? `${dropped} ${dropped === 1 ? 'dish isn’t' : 'dishes aren’t'} available now.` : priceChanges ? 'Some prices have changed since.' : undefined,
      });
      if (!r.payload.cart.empty) navigation.navigate('FoodBag');
    } else Toast.show({ type: 'error', text1: 'We couldn’t add those dishes again' });
  };

  return (
    <ScreenShell title="Your order" subtitle={`${o.code} · ${o.vendor.name}`} onBack={back} scroll padded={false} refreshing={status === 'loading'} onRefresh={refetch}>
      <View style={styles.content}>
        {/* Where it is */}
        <Card>
          <View style={styles.row}>
            <AppText variant="title" style={styles.grow} accessibilityRole="header">
              {label}
            </AppText>
            <StatusPill label={PAYMENT_STATUS[o.payment.status].label} tone={pillTone(PAYMENT_STATUS[o.payment.status].tone)} />
          </View>
          {headline ? (
            <AppText variant="body" tone={isNegativeEnd(o.status) ? 'muted' : 'accentDeep'}>
              {headline}
            </AppText>
          ) : null}
          <StatusTimeline steps={stepsOf(o)} />
          {live && channel.status !== 'connected' ? (
            <AppText variant="caption" tone="muted">
              Reconnecting… the page still updates every few seconds.
            </AppText>
          ) : null}
        </Card>

        {showMap ? (
          <View style={styles.map}>
            <FoodMap
              pins={[
                { id: 'kitchen', kind: 'vendor', at: kitchen!, label: o.vendor.name },
                { id: 'drop', kind: 'drop', at: tracking!.drop!, label: 'Your address' },
              ]}
              rider={riderAt}
              height={size.trackingMap}
              accessibilityLabel={riderAt ? `Map: ${o.vendor.name}, your address and the rider` : `Map: ${o.vendor.name} and your address`}
            />
          </View>
        ) : null}

        {/* The rider (the kitchen's own) */}
        {live && rider ? (
          <Card>
            <View style={styles.head}>
              <View style={[styles.riderBadge, { backgroundColor: service.accentSoft }]}>
                <IonIcon name="bicycle-outline" size="lg" color={service.accentDeep} />
              </View>
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{rider.name}</AppText>
                <AppText variant="small" tone="muted">
                  {`${riderStepLabel(rider.step)} · ${o.vendor.name}’s rider`}
                </AppText>
                {!rider.locationLive && o.status === 'on_the_way' ? (
                  <AppText variant="caption" tone="muted">
                    Location updating…
                  </AppText>
                ) : null}
              </View>
              {rider.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${rider.name}`} onPress={() => callNumber(rider.phone!)} /> : null}
            </View>
          </Card>
        ) : live && o.handedToExternal ? (
          <InlineNotice tone="info" message={`${o.vendor.name}’s own rider has your order.`} />
        ) : null}

        {/* Paying the kitchen */}
        {o.payment.method === 'transfer' && o.payment.accounts && !isNegativeEnd(o.status) ? (
          <TransferCard
            vendorName={o.vendor.name}
            amount={o.totals.total}
            accounts={o.payment.accounts}
            status={o.payment.status}
            payBy={o.payment.payBy}
            reference={o.payment.reference}
            rejectedReason={o.payment.rejectedReason}
            onSendReceipt={o.payment.status === 'awaiting_transfer' ? () => navigation.navigate('PaymentProof', { foodOrderCode: o.code }) : undefined}
          />
        ) : o.payment.instructions ? (
          <InlineNotice tone="info" message={o.payment.instructions} />
        ) : o.payment.status === 'refund_due' ? (
          <InlineNotice tone="warning" message={`${o.vendor.name} owes you a refund of ${formatPKR(o.totals.total)} for your transfer. Call them if you haven’t heard.`} />
        ) : null}

        {/* What you ordered */}
        <Card>
          <View style={styles.head}>
            <View style={styles.logo}>{o.vendor.logoUrl ? <Image source={{ uri: cdn(o.vendor.logoUrl, { w: size.avatar.md }) ?? undefined }} style={styles.fill} contentFit="cover" /> : null}</View>
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{o.vendor.name}</AppText>
              <AppText variant="small" tone="muted">
                {`${o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'} · ${PAYMENT_METHOD[o.payment.method].label}`}
              </AppText>
            </View>
            {o.vendor.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${o.vendor.name}`} onPress={() => callNumber(o.vendor.phone!)} /> : null}
          </View>
          <Divider />
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
            <AppText variant="body" tone="muted">
              Subtotal
            </AppText>
            <AppText variant="body">{formatPKR(o.totals.subtotal)}</AppText>
          </View>
          {o.totals.discount ? (
            <View style={styles.row}>
              <AppText variant="body" tone="muted">
                {o.deal?.code ? `Code ${o.deal.code}` : (o.deal?.title ?? 'Deal')}
              </AppText>
              <AppText variant="body" tone="success">{`− ${formatPKR(o.totals.discount)}`}</AppText>
            </View>
          ) : null}
          {o.fulfilment === 'delivery' ? (
            <View style={styles.row}>
              <AppText variant="body" tone="muted">
                Delivery
              </AppText>
              <AppText variant="body" tone={o.totals.deliveryFee ? 'ink' : 'success'}>
                {o.totals.deliveryFee ? formatPKR(o.totals.deliveryFee) : 'Free'}
              </AppText>
            </View>
          ) : null}
          <View style={styles.row}>
            <AppText variant="title">{`Paid to ${o.vendor.name}`}</AppText>
            <AppText variant="title">{formatPKR(o.totals.total)}</AppText>
          </View>
        </Card>

        {o.address ? (
          <Card>
            <View style={styles.head}>
              <IonIcon name="location-outline" size="lg" color={colors.inkMuted} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{o.address.fullName ?? 'Your address'}</AppText>
                <AppText variant="small" tone="muted">
                  {[o.address.line1, o.address.building, o.address.floor, o.address.area, o.address.city].filter(Boolean).join(', ')}
                </AppText>
                {o.address.phone ? (
                  <AppText variant="small" tone="muted">
                    {formatPkPhoneForDisplay(o.address.phone)}
                  </AppText>
                ) : null}
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.actions}>
          {o.canCancel ? <Button label="Cancel order" variant="secondary" onPress={() => dispatch(setCancelSheet(true))} fullWidth /> : null}
          {o.canReorder ? <Button label="Order again" leftIcon="refresh" onPress={() => void reorder()} fullWidth /> : null}
          {!o.canCancel && live ? (
            <AppText variant="small" tone="muted">
              {`To change or cancel now, call ${o.vendor.name}.`}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" tone="muted">
          {`${ORDER_STATUS[o.status].label}. You pay ${o.vendor.name} directly, and its own rider delivers. MetroMatrix takes no commission.`}
        </AppText>
        {o.vendor.phone && !live ? <TextAction label={`Call ${o.vendor.name}`} icon="call-outline" onPress={() => callNumber(o.vendor.phone!)} /> : null}
      </View>

      <Sheet visible={ui.cancelSheetOpen} onClose={() => dispatch(setCancelSheet(false))} title="Cancel this order?" subtitle={`${o.vendor.name} hasn’t accepted it yet.`}>
        {ui.cancelError.message ? <InlineNotice message={ui.cancelError.message} /> : null}
        {CUSTOMER_CANCEL_REASONS.map(r => (
          <ChoiceLine key={r} label={r} price={null} selected={false} multiple={false} disabled={ui.cancelling} onPress={() => void dispatch(cancelFoodOrderAsync({ code: o.code, reason: r }))} />
        ))}
        <Button label="Keep my order" variant="secondary" onPress={() => dispatch(setCancelSheet(false))} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default FoodOrderScreen;
