// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: your order, live
// ═══════════════════════════════════════════════════════
// Where the order is (the steps, the minutes left), the map with the
// kitchen, your address and the kitchen's own rider moving, the rider to
// call, how it's paid (a transfer's account and the receipt), what you
// ordered, and what you can do now: cancel before the kitchen answers,
// order it again, or rate it once it arrived. Live over the socket; read
// again after reconnects, and every few seconds while the connection is down.
// ONE pill (foodOrderHeadline), the kitchen named once in the order card,
// and ONE action in the sticky footer.

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useNow } from '../../hooks/useNow';
import { useOrderChannel } from '../../hooks/useFoodLive';
import {
  CUSTOMER_CANCEL_REASONS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PROGRESS,
  clock,
  foodOrderHeadline,
  isEnded,
  isNegativeEnd,
  orderStatusLabel,
  progressIndex,
  rejectReasonLabel,
  riderStepLabel,
  secondsLeft,
} from '../../models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { IonIcon } from '../../Custom-Components/Icon';
import { AppText, Button, Card, Divider, IconButton, ImageViewer, InlineNotice, LineItemRow, MoneyRows, ScreenShell, SectionCard, Sheet, StatusPill, StatusTimeline, StoreHeadRow, TextAction, type TimelineStep } from '../../Custom-Components/index';
import { OrderTrackSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { TrustNote } from '../../Components/food/FoodParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import { StarInput } from '../../Custom-Components/food/StarInput';
import { FoodMap } from '../../Custom-Components/food/map/FoodMap';
import type { FoodAppParamList, FoodOrder } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatSlot } from '../../utils/health-time/healthTime';
import { callNumber } from '../../utils/maps/maps';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { reorderFoodAsync, selectFoodBag } from '../food-bag-screen/foodBagSlice';
import { cancelFoodOrderAsync, foodOrderChanged, foodRiderMoved, loadFoodOrderAsync, selectFoodOrderEntry, selectFoodOrderUi, setCancelSheet } from './foodOrderSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodOrder'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    fill: { ...StyleSheet.absoluteFillObject },
    map: { borderRadius: radius.md, overflow: 'hidden' },
    riderBadge: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    packed: { width: size.packedPhoto, aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    lines: { gap: space.s12 },
    reasons: { gap: space.s4 },
    sheetButtons: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
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
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const { order: o, tracking, status, error } = useAppSelector(st => selectFoodOrderEntry(st, code));
  const ui = useAppSelector(selectFoodOrderUi);
  const now = useNow(1000);
  const [viewing, setViewing] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

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
        {status === 'failed' ? <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: refetch }} /> : <OrderTrackSkeleton />}
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
    const reorder = reorderFoodAsync.fulfilled.match(r) ? selectFoodBag(appStore.getState()).reorder : null;
    if (reorder) {
      const { dropped, priceChanges } = reorder;
      Toast.show({
        type: dropped ? 'info' : 'success',
        text1: reorder.cart.empty ? 'None of those dishes can be ordered now' : 'Back in your bag',
        text2: dropped ? `${dropped} ${dropped === 1 ? 'dish isn’t' : 'dishes aren’t'} available now.` : priceChanges ? 'Some prices have changed since.' : undefined,
      });
      if (!reorder.cart.empty) navigation.navigate('FoodBag');
    } else Toast.show({ type: 'error', text1: 'We couldn’t add those dishes again' });
  };

  const pill = foodOrderHeadline(o);
  const paid = o.payment.status === 'paid';
  const totalLabel = paid
    ? `Paid to ${o.vendor.name}`
    : isNegativeEnd(o.status)
      ? 'Order total'
      : o.payment.method === 'cod'
        ? `Pay ${o.vendor.name} on delivery`
        : o.payment.method === 'pay_at_pickup'
          ? `Pay ${o.vendor.name} at pick-up`
          : `Pay ${o.vendor.name}`;
  const transferCard = o.payment.method === 'transfer' && !!o.payment.accounts && !isNegativeEnd(o.status);
  // ONE action at the bottom: cancel while the kitchen hasn't answered, then order it again.
  const footer = o.canCancel ? (
    <Button label="Cancel order" variant="secondary" onPress={() => dispatch(setCancelSheet(true))} fullWidth />
  ) : o.canReorder ? (
    <Button label="Order again" leftIcon="refresh" onPress={() => void reorder()} fullWidth />
  ) : undefined;

  return (
    <ScreenShell title="Your order" subtitle={`${o.code} · ${o.vendor.name}`} onBack={back} scroll padded={false} refreshing={status === 'loading'} onRefresh={refetch} footer={footer}>
      <View style={styles.content}>
        {/* Where it is: ONE pill, the time, the steps */}
        <Card>
          <View style={styles.row}>
            <AppText variant="h2" style={styles.grow} accessibilityRole="header">
              {headline ?? label}
            </AppText>
            <StatusPill label={pill.label} tone={pill.tone} />
          </View>
          <StatusTimeline steps={stepsOf(o)} />
          {live && channel.status !== 'connected' ? (
            <AppText variant="caption" tone="muted">
              Reconnecting… the page still updates every few seconds.
            </AppText>
          ) : null}
          {/* How it was packed (the kitchen's photo; Kitchen Intelligence) */}
          {o.packedPhotoUrl ? (
            <>
              <Divider />
              <View style={styles.head}>
                <Pressable onPress={() => setViewing(true)} style={styles.packed} accessibilityRole="imagebutton" accessibilityLabel="Your order, packed. Open the photo">
                  <Image source={{ uri: cdn(o.packedPhotoUrl, { w: size.packedPhoto * 2, h: size.packedPhoto * 2 }) ?? o.packedPhotoUrl }} style={styles.fill} contentFit="cover" />
                </Pressable>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">How it was packed</AppText>
                  <AppText variant="small" tone="muted">
                    The kitchen took this photo of your order before it left.
                  </AppText>
                  <TextAction label="See the photo" onPress={() => setViewing(true)} />
                </View>
              </View>
            </>
          ) : null}
        </Card>

        {/* The map and the rider (the kitchen's own), in one card */}
        {showMap || (live && rider) ? (
          <Card>
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
            {live && rider ? (
              <View style={styles.head}>
                <View style={[styles.riderBadge, { backgroundColor: service.accentSoft }]}>
                  <IonIcon name="bicycle-outline" size="lg" color={service.accentDeep} />
                </View>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{rider.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {`${riderStepLabel(rider.step)} · the kitchen’s own rider`}
                  </AppText>
                  {!rider.locationLive && o.status === 'on_the_way' ? (
                    <AppText variant="caption" tone="muted">
                      Location updating…
                    </AppText>
                  ) : null}
                </View>
                {rider.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${rider.name}`} onPress={() => callNumber(rider.phone!)} /> : null}
              </View>
            ) : null}
          </Card>
        ) : live && o.handedToExternal ? (
          <InlineNotice tone="info" message={`${o.vendor.name}’s own rider has your order.`} />
        ) : null}

        {/* Paying the kitchen */}
        {transferCard ? (
          <TransferCard
            vendorName={o.vendor.name}
            amount={o.totals.total}
            accounts={o.payment.accounts!}
            status={o.payment.status}
            payBy={o.payment.payBy}
            reference={o.payment.reference}
            rejectedReason={o.payment.rejectedReason}
            onSendReceipt={o.payment.status === 'awaiting_transfer' ? () => navigation.navigate('PaymentProof', { foodOrderCode: o.code }) : undefined}
          />
        ) : o.payment.instructions || o.payment.status === 'refund_due' ? (
          <SectionCard title="Payment" subtitle={PAYMENT_METHOD[o.payment.method].label} icon="wallet-outline" action={<StatusPill label={PAYMENT_STATUS[o.payment.status].pill} tone={PAYMENT_STATUS[o.payment.status].tone} />}>
            {o.payment.status === 'refund_due' ? (
              <InlineNotice embedded tone="warning" message={`${o.vendor.name} owes you a refund of ${formatPKR(o.totals.total)} for your transfer. Call them if you haven’t heard.`} />
            ) : (
              <AppText variant="small" tone="muted">
                {o.payment.instructions}
              </AppText>
            )}
          </SectionCard>
        ) : null}

        {/* What you ordered — the kitchen named once, here */}
        <Card>
          <StoreHeadRow
            store={{ name: o.vendor.name, logoUrl: o.vendor.logoUrl, brandColor: service.accent }}
            meta={`${o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'} · ${PAYMENT_METHOD[o.payment.method].label}`}
            trailing={o.vendor.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${o.vendor.name}`} onPress={() => callNumber(o.vendor.phone!)} /> : null}
            chevron={false}
          />
          <Divider />
          <View style={styles.lines}>
            {o.items.map(i => (
              <LineItemRow
                key={i.id}
                shape="none"
                imageUrl={null}
                name={`${i.quantity} × ${i.name}`}
                meta={[i.variant, i.options.map(x => x.name).join(', ')].filter(Boolean).join(' · ') || null}
                price={formatPKR(i.lineTotal)}
                priceTone="ink"
              />
            ))}
          </View>
          <Divider />
          <MoneyRows
            rows={[
              { label: 'Subtotal', value: o.totals.subtotal },
              o.totals.discount ? { label: o.deal?.code ? `Code ${o.deal.code}` : (o.deal?.title ?? 'Deal'), value: o.totals.discount, kind: 'discount' } : null,
              o.fulfilment === 'delivery' ? { label: 'Delivery (the kitchen’s own rider)', value: o.totals.deliveryFee, kind: 'free' } : null,
              { label: totalLabel, value: o.totals.total, kind: 'total' },
            ]}
          />
        </Card>

        {o.address ? (
          <SectionCard title="Delivering to" icon="location-outline">
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
          </SectionCard>
        ) : null}

        {o.canReview ? (
          <SectionCard title="How was it?" subtitle={`Rate the food${o.fulfilment === 'delivery' ? ' and the delivery' : ''}. It helps ${o.vendor.name}, and other customers.`} icon="star-outline">
            <StarInput label="The food" value={0} onChange={n => navigation.navigate('FoodRateOrder', { code: o.code, stars: n })} />
          </SectionCard>
        ) : null}

        {!o.canCancel && live ? (
          <AppText variant="small" tone="muted">
            {`To change or cancel now, call ${o.vendor.name}.`}
          </AppText>
        ) : null}
        {o.vendor.phone && !live ? <TextAction label={`Call ${o.vendor.name}`} icon="call-outline" onPress={() => callNumber(o.vendor.phone!)} /> : null}
        <TrustNote text={customerTrustLine(o.vendor.name, { riders: o.fulfilment === 'delivery' })} />
      </View>

      <Sheet
        visible={ui.cancelSheetOpen}
        onClose={() => {
          setReason(null);
          dispatch(setCancelSheet(false));
        }}
        title="Cancel this order?"
        subtitle={`${o.vendor.name} hasn’t accepted it yet. Why are you cancelling?`}
        footer={
          <View style={styles.sheetButtons}>
            <View style={styles.half}>
              <Button label="Keep my order" variant="secondary" onPress={() => dispatch(setCancelSheet(false))} fullWidth />
            </View>
            <View style={styles.half}>
              <Button
                label="Cancel order"
                variant="destructive"
                disabled={!reason}
                loading={ui.cancelling}
                onPress={() => reason && void dispatch(cancelFoodOrderAsync({ code: o.code, reason }))}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {ui.cancelError.message ? <InlineNotice message={ui.cancelError.message} /> : null}
        <View style={styles.reasons} accessibilityRole="radiogroup" accessibilityLabel="Why you’re cancelling">
          {CUSTOMER_CANCEL_REASONS.map(r => (
            <ChoiceLine key={r} label={r} price={null} selected={reason === r} multiple={false} disabled={ui.cancelling} onPress={() => setReason(r)} />
          ))}
        </View>
      </Sheet>
      <ImageViewer visible={viewing} uri={o.packedPhotoUrl} title={`Order ${o.code}, packed`} onClose={() => setViewing(false)} />
    </ScreenShell>
  );
};

export default FoodOrderScreen;
