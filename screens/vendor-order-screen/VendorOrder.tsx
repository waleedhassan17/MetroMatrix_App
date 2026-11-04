// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one order
// ═══════════════════════════════════════════════════════
// Everything the kitchen needs for one order: the time left to answer, the
// customer (call, WhatsApp, directions to the drop-off), each dish with its
// choices and note, cutlery, the money and how it's paid — a transfer's
// reference to check against the kitchen's own account — and the moves the
// server allows now. Live: read again whenever the order changes. When the
// kitchen asks for a packing photo (Kitchen settings), "Ready" waits for it;
// the assistant's look at it is advice only (docs/API_KITCHEN.md). Titled
// section cards, ONE pill, the next step in a sticky footer, and "Cancel
// order" at the foot, asking first.

import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useNow } from '../../hooks/useNow';
import { useOrderChannel } from '../../hooks/useFoodLive';
import {
  DEFAULT_PREP_MINUTES,
  ETA_CHOICES,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_REJECT_REASONS,
  PAYMENT_STATUS,
  REJECT_REASONS,
  VENDOR_CANCEL_REASONS,
  VENDOR_STATUS_ACTION,
  agoLabel,
  clock,
  isEnded,
  rejectReasonLabel,
  riderStepLabel,
  secondsLeft,
  ticketHeadline,
  VENDOR_ORDER_LINE,
  VENDOR_RIDER_LINE,
} from '../../models/food/foodStatusModel';
import { VENDOR_TRUST_LINE } from '../../models/food/trustModel';
import { distanceLabel } from '../../models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Avatar, Button, Card, Checkbox, ChoiceChip, DangerRow, Divider, IconButton, InlineNotice, IonIcon, LineItemRow, MoneyRows, ScreenShell, SectionCard, Sheet, Skeleton, StatusPill, StatusTimeline, TextAction } from '../../Custom-Components/index';
import { OrderTrackSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { TrustNote } from '../../Components/food/FoodParts';
import { batchLine } from '../../models/kitchen/reachModel';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodOrderStatus, FoodVendorStackParamList } from '../../models';
import { formatSlot } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { callNumber, navigateTo, openWhatsApp } from '../../utils/maps/maps';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { pickImageFromLibrary, takePhoto } from '../../utils/pickers/pickers';
import {
  loadPackingRuleAsync,
  loadSuggestionsAsync,
  loadVendorOrderAsync,
  packingPhotoAsync,
  selectVendorOrderEntry,
  selectVendorOrderUi,
  setAssignOpen,
  toggleTogether,
  assignTogetherAsync,
  setReasonSheet,
  vendorOrderActAsync,
  type VendorOrderAct,
} from './vendorOrderSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorOrder'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space, gutter, radius, colors, size }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    together: { gap: space.s8, paddingBottom: space.s8 },
    actions: { gap: space.s8 },
    event: { flexDirection: 'row', gap: space.s12 },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    packed: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    lines: { gap: space.s12 },
    footer: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    reasons: { gap: space.s4 },
  });

const VendorOrder: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorOrderContent {...props} />
  </ServiceScope>
);

const itemsLabel = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

/** The moves shown as buttons, in the order a kitchen expects them. */
const MOVE_ORDER: FoodOrderStatus[] = ['preparing', 'ready', 'on_the_way', 'picked_up', 'delivered'];

const VendorOrderContent: React.FC<Props> = ({ route }) => {
  const { id, assign } = route.params;
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'OrdersTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const { order: o, status, error } = useAppSelector(st => selectVendorOrderEntry(st, id));
  const ui = useAppSelector(selectVendorOrderUi);
  const now = useNow(1000);
  const [eta, setEta] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const refetch = useCallback(() => void dispatch(loadVendorOrderAsync(id)), [dispatch, id]);
  useEffect(() => {
    refetch();
    void dispatch(loadPackingRuleAsync());
  }, [refetch, dispatch]);
  // Any change to this order: read it again (the kitchen's socket gets board cards, not this view).
  useOrderChannel(o && !isEnded(o.status) ? o.id : null, { refetch });

  const pickRider = useCallback(() => {
    dispatch(setAssignOpen(true));
    void dispatch(loadSuggestionsAsync(id));
  }, [dispatch, id]);
  // From the board's "Give to a rider": the picker, once the order is in.
  const loaded = !!o;
  const openedPicker = React.useRef(false);
  useEffect(() => {
    if (assign && loaded && !openedPicker.current) {
      openedPicker.current = true;
      pickRider();
    }
  }, [assign, loaded, pickRider]);

  const act = async (a: VendorOrderAct, done?: string) => {
    haptics.press();
    const r = await dispatch(vendorOrderActAsync({ id, act: a }));
    if (vendorOrderActAsync.fulfilled.match(r)) {
      haptics.success();
      if (done) Toast.show({ type: 'success', text1: done });
    } else haptics.warning();
  };

  /** This order to the rider, then any picked to ride with it. */
  const giveTo = async (riderId: string, name: string) => {
    const along = ui.together;
    await act({ kind: 'assign', riderId }, along.length ? undefined : `Given to ${name}`);
    if (!along.length) return;
    const r = await dispatch(assignTogetherAsync({ orderIds: along, riderId }));
    if (assignTogetherAsync.fulfilled.match(r)) Toast.show({ type: 'success', text1: `${along.length + 1} orders given to ${name}`, text2: 'They see the drops in order.' });
  };

  if (!o) {
    return (
      <ScreenShell title="Order" onBack={back} scroll>
        {status === 'failed' ? <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: refetch }} /> : <OrderTrackSkeleton />}
      </ScreenShell>
    );
  }

  const left = o.status === 'placed' ? secondsLeft(o.acceptBy, now) : null;
  const pay = PAYMENT_STATUS[o.payment.status];
  const canAssign = o.fulfilment === 'delivery' && ['accepted', 'preparing', 'ready'].includes(o.status) && !o.handedToExternal;
  // Handing to someone off the app lives in the rider picker, behind "Give to a rider".
  const moves = MOVE_ORDER.filter(s => o.actions.status.includes(s) && !(s === 'on_the_way' && (o.rider || canAssign)));
  const beforePickup = !o.rider || ['assigned', 'accepted_by_rider', 'arrived_at_branch'].includes(o.rider.step);
  const canAccept = o.actions.status.includes('accepted');
  const a = o.address;
  // The packing photo: asked for before the order leaves (required: on its way or picked up), or offered (optional).
  const packingOn = ui.packingRule === 'optional' || ui.packingRule === 'required';
  const beforeLeaving = ['accepted', 'preparing', 'ready'].includes(o.status);
  const photoFirst = ui.packingRule === 'required' && !o.packedPhotoUrl && (o.actions.status.includes('on_the_way') || o.actions.status.includes('picked_up'));
  const showPacking = (packingOn && beforeLeaving) || !!o.packedPhotoUrl;
  const shownMoves = photoFirst ? moves.filter(m => m !== 'on_the_way' && m !== 'picked_up') : moves;
  const addPacking = async (how: 'camera' | 'library') => {
    const file = how === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (!file) return;
    const r = await dispatch(packingPhotoAsync({ id, file }));
    if (packingPhotoAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Packing photo added', text2: 'The customer sees it on their order.' });
    } else haptics.warning();
  };

  const pill = ticketHeadline(o);
  const chosenEta = eta ?? DEFAULT_PREP_MINUTES;
  const moveAct = (m: FoodOrderStatus): VendorOrderAct =>
    m === 'preparing' ? { kind: 'preparing' } : m === 'ready' ? { kind: 'ready' } : m === 'on_the_way' ? { kind: 'handed-external' } : m === 'picked_up' ? { kind: 'picked-up' } : { kind: 'delivered' };
  const runMove = async (m: FoodOrderStatus) => {
    setMoving(m);
    await act(moveAct(m), ORDER_STATUS[m].vendorLabel);
    setMoving(null);
  };
  const collectLabel = o.payment.method === 'cod' ? 'Collect at the door' : o.payment.method === 'pay_at_pickup' ? 'Collect at the counter' : 'Total';
  const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);

  // ONE next step, sticky: answer a new order, take the packing photo, move it on, or give it to a rider.
  const footer = canAccept ? (
    <View style={styles.footer}>
      {o.actions.status.includes('rejected') ? (
        <View style={styles.half}>
          <Button label="Decline" variant="secondary" onPress={() => dispatch(setReasonSheet('reject'))} fullWidth />
        </View>
      ) : null}
      <View style={styles.half}>
        <Button
          label={o.scheduledFor ? 'Accept' : `Accept · ${chosenEta} min`}
          loading={ui.acting === 'accept'}
          onPress={() => void act({ kind: 'accept', eta: chosenEta }, o.scheduledFor ? 'Accepted' : `Accepted · ${chosenEta} min`)}
          fullWidth
        />
      </View>
    </View>
  ) : photoFirst && beforeLeaving ? (
    <Button label="Take the packing photo" leftIcon="camera-outline" loading={ui.packingUploading} onPress={() => void addPacking('camera')} fullWidth />
  ) : shownMoves.length || (canAssign && !o.rider) ? (
    <View style={styles.footer}>
      {canAssign && !o.rider ? (
        <View style={styles.half}>
          <Button label="Give to a rider" leftIcon="bicycle-outline" variant={shownMoves.length ? 'secondary' : 'primary'} onPress={pickRider} fullWidth />
        </View>
      ) : null}
      {shownMoves.length ? (
        <View style={styles.half}>
          <Button label={VENDOR_STATUS_ACTION[shownMoves[0]] ?? shownMoves[0]} loading={moving === shownMoves[0]} disabled={ui.acting !== null} onPress={() => void runMove(shownMoves[0])} fullWidth />
        </View>
      ) : null}
    </View>
  ) : undefined;

  return (
    <ScreenShell title={`Order ${o.code}`} subtitle={`${o.customer.name} · ${itemsLabel(itemCount)}`} onBack={back} scroll padded={false} refreshing={status === 'loading'} onRefresh={refetch} footer={footer}>
      <View style={styles.content}>
        {ui.actionError.message && !ui.sheet ? <InlineNotice message={ui.actionError.message} /> : null}

        {/* Where it is: ONE pill, the clock, the time to answer */}
        <Card>
          <View style={styles.row}>
            <View style={styles.head}>
              <IonIcon name={o.fulfilment === 'pickup' ? 'bag-handle-outline' : 'bicycle-outline'} size="md" color={colors.inkMuted} />
              <AppText variant="title">{o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'}</AppText>
            </View>
            <StatusPill label={pill.label} tone={pill.tone} />
          </View>
          <AppText variant="small" tone="muted">
            {`Placed ${agoLabel(o.placedAt, now).toLowerCase()} · ${formatSlot(o.placedAt, TZ)}`}
          </AppText>
          {o.scheduledFor ? <AppText variant="bodyStrong" tone="accentDeep">{`For ${formatSlot(o.scheduledFor, TZ)}`}</AppText> : null}
          {left !== null ? (
            <AppText variant="bodyStrong" tone={left < 60 ? 'warning' : 'accentDeep'}>
              {left > 0 ? `${clock(left)} to answer, or it’s declined for you` : 'Time to answer has run out'}
            </AppText>
          ) : o.eta.promisedAt && !isEnded(o.status) ? (
            <AppText variant="small">{`Promised for ${formatSlot(o.eta.promisedAt, TZ)}`}</AppText>
          ) : null}
          {o.cancelReason && (o.status === 'rejected' || o.status === 'cancelled' || o.status === 'auto_rejected') ? (
            <AppText variant="small" tone="muted">
              {o.status === 'rejected' ? rejectReasonLabel(o.cancelReason) : o.cancelReason}
            </AppText>
          ) : null}
          {canAccept && !o.scheduledFor ? (
            <>
              <Divider />
              <AppText variant="label">{o.fulfilment === 'pickup' ? 'Ready in' : 'With the customer in'}</AppText>
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Time to the customer">
                {ETA_CHOICES.map(m => (
                  <ChoiceChip key={m} label={`${m} min`} selected={m === chosenEta} onPress={() => setEta(m)} />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {/* The packing photo */}
        {showPacking ? (
          <SectionCard
            title="Packing photo"
            subtitle={ui.packingRule === 'required' && !o.packedPhotoUrl ? 'Take it before the order leaves the kitchen. The customer sees it on their order.' : 'The customer sees it on their order.'}
            icon="camera-outline"
            invalid={photoFirst}>
            {o.packedPhotoUrl ? <Image source={{ uri: o.packedPhotoUrl }} style={styles.packed} contentFit="cover" accessibilityLabel={`Order ${o.code}, packed`} /> : null}
            {ui.packingCheck ? (
              <AppText variant="small" tone={ui.packingCheck.ok ? 'success' : 'warning'}>
                {ui.packingCheck.note}
              </AppText>
            ) : null}
            {ui.packingError.message ? <InlineNotice embedded message={ui.packingError.message} /> : null}
            {beforeLeaving ? (
              <View style={styles.links}>
                <TextAction label={o.packedPhotoUrl ? 'Retake' : 'Take it'} icon="camera-outline" onPress={() => void addPacking('camera')} disabled={ui.packingUploading} />
                <TextAction label="From your photos" icon="image-outline" onPress={() => void addPacking('library')} disabled={ui.packingUploading} />
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {/* The rider (the kitchen's own) */}
        {o.rider ? (
          <SectionCard title="Rider" icon="bicycle-outline">
            <View style={styles.head}>
              <Avatar name={o.rider.name} size="md" />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{o.rider.name}</AppText>
                <AppText variant="small" tone="muted">
                  {riderStepLabel(o.rider.step, 'vendor')}
                </AppText>
                <AppText variant="caption" tone={o.rider.locationLive ? 'success' : 'muted'}>
                  {o.rider.locationLive ? VENDOR_RIDER_LINE.locationLive : VENDOR_RIDER_LINE.locationOff}
                </AppText>
              </View>
              {o.rider.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${o.rider.name}`} onPress={() => callNumber(o.rider!.phone!)} /> : null}
            </View>
            {canAssign && beforePickup ? <TextAction label="Give to another rider" icon="swap-horizontal-outline" onPress={pickRider} /> : null}
          </SectionCard>
        ) : o.handedToExternal && !isEnded(o.status) ? (
          <InlineNotice tone="info" message={`${VENDOR_RIDER_LINE.withRider}. Mark it delivered when it reaches the customer.`} />
        ) : null}
        {shownMoves.length > 1 ? (
          <View style={styles.links}>
            {shownMoves.slice(1).map(m => (
              <TextAction key={m} label={VENDOR_STATUS_ACTION[m] ?? m} onPress={() => void runMove(m)} disabled={ui.acting !== null} />
            ))}
          </View>
        ) : null}

        {/* The customer */}
        <SectionCard title={o.fulfilment === 'pickup' ? 'Collecting' : 'Delivering to'} icon="person-outline">
          <View style={styles.head}>
            <Avatar name={o.customer.name} size="md" />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{o.customer.name}</AppText>
              {o.customer.phone ? (
                <AppText variant="small" tone="muted">
                  {formatPkPhoneForDisplay(o.customer.phone)}
                </AppText>
              ) : null}
            </View>
            {o.customer.phone ? (
              <>
                <IconButton icon="logo-whatsapp" accessibilityLabel={`WhatsApp ${o.customer.name}`} onPress={() => openWhatsApp(o.customer.phone!)} />
                <IconButton icon="call-outline" accessibilityLabel={`Call ${o.customer.name}`} onPress={() => callNumber(o.customer.phone!)} />
              </>
            ) : null}
          </View>
          {a ? (
            <>
              <Divider />
              <AppText variant="body">{[a.line1, a.building, a.floor, a.area, a.city].filter(Boolean).join(', ')}</AppText>
              {a.landmark ? (
                <AppText variant="small" tone="muted">
                  {a.landmark}
                </AppText>
              ) : null}
              {a.riderInstructions ? <AppText variant="small" tone="accentDeep">{`For the rider: ${a.riderInstructions}`}</AppText> : null}
              {distanceLabel(o.distanceKm) ? <AppText variant="caption" tone="muted">{`${distanceLabel(o.distanceKm)} away`}</AppText> : null}
              {a.lat !== null && a.lng !== null ? <TextAction label="Directions" icon="navigate-outline" onPress={() => navigateTo(a.lat!, a.lng!)} /> : null}
            </>
          ) : null}
        </SectionCard>

        {/* What to cook */}
        <SectionCard title={itemsLabel(itemCount)} subtitle={o.cutlery ? VENDOR_ORDER_LINE.cutlery : 'No cutlery'} icon="restaurant-outline">
          <View style={styles.lines}>
            {o.items.map(i => (
              <LineItemRow
                key={i.id}
                shape="none"
                imageUrl={null}
                name={`${i.quantity} × ${i.name}`}
                meta={[i.variant, i.options.map(x => x.name).join(', ')].filter(Boolean).join(' · ') || null}
                price={formatPKR(i.lineTotal)}
                priceTone="ink">
                {i.notes ? <AppText variant="small" tone="accentDeep">{`“${i.notes}”`}</AppText> : null}
              </LineItemRow>
            ))}
          </View>
          {o.note ? <InlineNotice embedded tone="info" message={`From the customer: ${o.note}`} /> : null}
        </SectionCard>

        {/* The money (all of it the kitchen's) */}
        <SectionCard
          title={PAYMENT_METHOD[o.payment.method].label}
          icon="wallet-outline"
          action={pay.vendorLabel !== PAYMENT_METHOD[o.payment.method].label ? <StatusPill label={pay.vendorLabel} tone={pay.tone} /> : undefined}>
          <MoneyRows
            rows={[
              { label: 'Subtotal', value: o.totals.subtotal },
              o.totals.discount ? { label: o.deal?.code ? `Code ${o.deal.code}` : (o.deal?.title ?? 'Your deal'), value: o.totals.discount, kind: 'discount' } : null,
              o.fulfilment === 'delivery' ? { label: 'Delivery', value: o.totals.deliveryFee, kind: 'free' } : null,
              { label: collectLabel, value: o.totals.total, kind: 'total' },
            ]}
          />
          {o.payment.method === 'transfer' && o.payment.reference ? (
            <>
              <Divider />
              <AppText variant="small" tone="muted">
                Reference from the customer
              </AppText>
              <AppText variant="bodyStrong" selectable>
                {o.payment.reference}
              </AppText>
              {o.payment.proofUrl ? <TextAction label="See the receipt" icon="image-outline" onPress={() => void Linking.openURL(o.payment.proofUrl!).catch(() => undefined)} /> : null}
            </>
          ) : null}
          {o.actions.payment.includes('paid') || o.actions.payment.includes('awaiting_transfer') ? (
            <View style={styles.footer}>
              {o.actions.payment.includes('awaiting_transfer') ? (
                <View style={styles.half}>
                  <Button label="Not received" variant="secondary" onPress={() => dispatch(setReasonSheet('reject-payment'))} fullWidth />
                </View>
              ) : null}
              {o.actions.payment.includes('paid') ? (
                <View style={styles.half}>
                  <Button label="It’s in our account" loading={ui.acting === 'confirm-payment'} onPress={() => void act({ kind: 'confirm-payment' }, 'Payment confirmed')} fullWidth />
                </View>
              ) : null}
            </View>
          ) : null}
          {o.payment.status === 'refund_due' ? <InlineNotice embedded tone="warning" message={`You owe the customer ${formatPKR(o.totals.total)} back for this transfer.`} /> : null}
          <TrustNote text={VENDOR_TRUST_LINE} />
        </SectionCard>

        {/* What happened */}
        {o.events.length ? (
          <SectionCard title="History" icon="time-outline">
            <StatusTimeline
              steps={o.events.map(e => ({
                label:
                  e.kind === 'payment'
                    ? `Payment: ${PAYMENT_STATUS[e.to as keyof typeof PAYMENT_STATUS]?.vendorLabel ?? e.to}`
                    : e.kind === 'rider'
                      ? riderStepLabel(e.to ?? '', 'vendor')
                      : (ORDER_STATUS[e.to as FoodOrderStatus]?.vendorLabel ?? e.to ?? ''),
                description: [formatSlot(e.at, TZ), e.note && e.kind !== 'payment' ? (e.to === 'rejected' ? rejectReasonLabel(e.note) : e.note) : null].filter(Boolean).join(' · '),
                state: 'done' as const,
              }))}
            />
          </SectionCard>
        ) : null}

        {o.actions.status.includes('cancelled') ? <DangerRow label="Cancel order" icon="close-circle-outline" onConfirm={() => dispatch(setReasonSheet('cancel'))} /> : null}
      </View>

      <Sheet visible={ui.assignOpen} onClose={() => dispatch(setAssignOpen(false))} title="Give to a rider" subtitle="Your riders on duty: fewest deliveries first, then nearest.">
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {ui.suggestStatus === 'loading' && !ui.suggestions.length ? <Skeleton height={size.control.lg * 2} shape="md" /> : null}
        {ui.suggestStatus === 'succeeded' && !ui.suggestions.length ? (
          <InlineNotice tone="info" message="None of your riders is on duty. Ask one to go on duty, or hand it to your own rider." />
        ) : null}
        {ui.batch.length ? (
          <View style={styles.together}>
            <AppText variant="label">Ride together</AppText>
            <AppText variant="small" tone="muted">
              These orders are going the same way. Pick them to give them to the same rider.
            </AppText>
            {ui.batch.slice(0, 3).map(b => (
              <Checkbox
                key={b.orderId}
                checked={ui.together.includes(b.orderId)}
                onToggle={() => dispatch(toggleTogether(b.orderId))}
                label={`${b.code} · ${batchLine(b)}`}
                accessibilityLabel={`Also give ${b.code} to the same rider: ${batchLine(b)}`}
              />
            ))}
          </View>
        ) : null}
        {ui.suggestions.map(r => (
          <ChoiceLine
            key={r.riderId}
            label={r.fullName}
            price={null}
            note={[
              r.activeOrders ? `${r.activeOrders} ${r.activeOrders === 1 ? 'delivery' : 'deliveries'} now` : 'Free now',
              distanceLabel(r.distanceKm) ? `${distanceLabel(r.distanceKm)} away` : r.locationLive ? null : VENDOR_RIDER_LINE.locationOff,
            ]
              .filter(Boolean)
              .join(' · ')}
            selected={o.rider?.name === r.fullName}
            multiple={false}
            disabled={ui.acting !== null}
            onPress={() => void giveTo(r.riderId, r.fullName)}
          />
        ))}
        {o.actions.status.includes('on_the_way') && !o.rider ? (
          <Button label="Hand to someone not on the app" variant="secondary" onPress={() => void act({ kind: 'handed-external' }, 'Handed to your rider')} fullWidth />
        ) : null}
      </Sheet>

      <Sheet
        visible={!!ui.sheet}
        onClose={() => {
          setReason(null);
          dispatch(setReasonSheet(null));
        }}
        title={ui.sheet === 'reject' ? `Decline ${o.code}?` : ui.sheet === 'cancel' ? `Cancel ${o.code}?` : 'Transfer not received'}
        subtitle={
          ui.sheet === 'reject-payment'
            ? 'The customer is told why and gets 10 more minutes to send it.'
            : ui.sheet === 'cancel' && o.payment.status === 'paid'
              ? 'They paid by transfer: you’ll owe them a refund.'
              : 'The customer is told why.'
        }
        footer={
          <View style={styles.footer}>
            <View style={styles.half}>
              <Button label="Go back" variant="secondary" onPress={() => dispatch(setReasonSheet(null))} fullWidth />
            </View>
            <View style={styles.half}>
              <Button
                label={ui.sheet === 'reject' ? 'Decline' : ui.sheet === 'cancel' ? 'Cancel order' : 'Tell the customer'}
                variant={ui.sheet === 'reject-payment' ? 'primary' : 'destructive'}
                disabled={!reason}
                loading={ui.acting !== null}
                onPress={() => {
                  if (!reason) return;
                  void act(
                    ui.sheet === 'reject' ? { kind: 'reject', reason } : ui.sheet === 'cancel' ? { kind: 'cancel', reason } : { kind: 'reject-payment', reason },
                    ui.sheet === 'reject' ? 'Declined' : ui.sheet === 'cancel' ? 'Cancelled' : 'The customer has been told',
                  );
                  setReason(null);
                }}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        <View style={styles.reasons} accessibilityRole="radiogroup" accessibilityLabel="Why">
          {(ui.sheet === 'reject' ? REJECT_REASONS.map(r => ({ key: r.key, label: r.label })) : (ui.sheet === 'cancel' ? VENDOR_CANCEL_REASONS : PAYMENT_REJECT_REASONS).map(r => ({ key: r, label: r }))).map(r => (
            <ChoiceLine key={r.key} label={r.label} price={null} selected={reason === r.key} multiple={false} disabled={ui.acting !== null} onPress={() => setReason(r.key)} />
          ))}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default VendorOrder;
