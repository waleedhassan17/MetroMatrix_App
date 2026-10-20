// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one order
// ═══════════════════════════════════════════════════════
// Everything the kitchen needs for one order: the time left to answer, the
// customer (call, WhatsApp, directions to the drop-off), each dish with its
// choices and note, cutlery, the money and how it's paid — a transfer's
// reference to check against the kitchen's own account — and the moves the
// server allows now. Live: read again whenever the order changes. When the
// kitchen asks for a packing photo (Kitchen settings), "Ready" waits for it;
// the assistant's look at it is advice only (TODO(API_KITCHEN)).

import React, { useCallback, useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useNow } from '@hooks/useNow';
import { useOrderChannel } from '@hooks/useFoodLive';
import {
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
  pillTone,
  rejectReasonLabel,
  riderStepLabel,
  secondsLeft,
} from '@models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Checkbox, ChoiceChip, Divider, IconButton, InlineNotice, IonIcon, ScreenShell, Sheet, SkeletonLines, StatusPill, TextAction } from '@custom/index';
import { batchLine } from '@models/kitchen/reachModel';
import { ChoiceLine } from '@custom/food/ChoiceLine';
import type { FoodOrderStatus, FoodVendorStackParamList } from '@/types';
import { formatSlot } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import { callNumber, navigateTo, openWhatsApp } from '@utils/maps';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { pickImageFromLibrary, takePhoto } from '@utils/pickers';
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
    content: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s16 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    together: { gap: space.s8, paddingBottom: space.s8 },
    actions: { gap: space.s8 },
    event: { flexDirection: 'row', gap: space.s12 },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    packed: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

const VendorOrderScreen: React.FC<Props> = props => (
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
  const { colors } = useTheme();
  const { order: o, status, error } = useAppSelector(st => selectVendorOrderEntry(st, id));
  const ui = useAppSelector(selectVendorOrderUi);
  const now = useNow(1000);

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
        {status === 'failed' ? <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: refetch }} /> : <SkeletonLines lines={10} />}
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
  // The packing photo: asked for before Ready (required), or offered (optional).
  const packingOn = ui.packingRule === 'optional' || ui.packingRule === 'required';
  const beforeLeaving = ['accepted', 'preparing', 'ready'].includes(o.status);
  const photoFirst = ui.packingRule === 'required' && !o.packedPhotoUrl && o.actions.status.includes('ready');
  const showPacking = (packingOn && beforeLeaving) || !!o.packedPhotoUrl;
  const shownMoves = photoFirst ? moves.filter(m => m !== 'ready') : moves;
  const addPacking = async (how: 'camera' | 'library') => {
    const file = how === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (!file) return;
    const r = await dispatch(packingPhotoAsync({ id, file }));
    if (packingPhotoAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Packing photo added', text2: 'The customer sees it on their order.' });
    } else haptics.warning();
  };

  return (
    <ScreenShell title={`Order ${o.code}`} subtitle={ORDER_STATUS[o.status].vendorLabel} onBack={back} scroll padded={false} refreshing={status === 'loading'} onRefresh={refetch}>
      <View style={styles.content}>
        {ui.actionError.message && !ui.sheet ? <InlineNotice message={ui.actionError.message} /> : null}

        {/* Where it is */}
        <Card>
          <View style={styles.row}>
            <AppText variant="title">{o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'}</AppText>
            <StatusPill label={ORDER_STATUS[o.status].vendorLabel} tone={pillTone(ORDER_STATUS[o.status].tone)} />
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
        </Card>

        {/* Answer a new order */}
        {canAccept ? (
          <Card>
            <AppText variant="title">{o.scheduledFor ? 'Accept for its time' : o.fulfilment === 'pickup' ? 'Ready in' : 'With the customer in'}</AppText>
            {o.scheduledFor ? (
              <Button label={`Accept for ${formatSlot(o.scheduledFor, TZ)}`} loading={ui.acting === 'accept'} onPress={() => void act({ kind: 'accept', eta: 30 }, 'Accepted')} fullWidth />
            ) : (
              <View style={styles.chips}>
                {ETA_CHOICES.map(m => (
                  <ChoiceChip key={m} label={`${m} min`} selected={false} onPress={() => void act({ kind: 'accept', eta: m }, `Accepted · ${m} min`)} />
                ))}
              </View>
            )}
            {o.actions.status.includes('rejected') ? <Button label="Decline" variant="secondary" onPress={() => dispatch(setReasonSheet('reject'))} fullWidth /> : null}
          </Card>
        ) : null}

        {/* The packing photo */}
        {showPacking ? (
          <Card>
            <AppText variant="title">Packing photo</AppText>
            <AppText variant="small" tone="muted">
              {ui.packingRule === 'required' && !o.packedPhotoUrl
                ? 'Take it before you mark the order ready. The customer sees it on their order.'
                : 'The customer sees it on their order.'}
            </AppText>
            {o.packedPhotoUrl ? <Image source={{ uri: o.packedPhotoUrl }} style={styles.packed} contentFit="cover" accessibilityLabel={`Order ${o.code}, packed`} /> : null}
            {ui.packingCheck ? (
              <AppText variant="small" tone={ui.packingCheck.ok ? 'success' : 'warning'}>
                {ui.packingCheck.note}
              </AppText>
            ) : null}
            {ui.packingError.message ? <InlineNotice message={ui.packingError.message} /> : null}
            {beforeLeaving ? (
              photoFirst || !o.packedPhotoUrl ? (
                <>
                  <Button
                    label="Take the packing photo"
                    leftIcon="camera-outline"
                    variant={photoFirst ? 'primary' : 'secondary'}
                    loading={ui.packingUploading}
                    onPress={() => void addPacking('camera')}
                    fullWidth
                  />
                  <TextAction label="From your photos" icon="image-outline" onPress={() => void addPacking('library')} disabled={ui.packingUploading} />
                </>
              ) : (
                <View style={styles.links}>
                  <TextAction label="Retake" icon="camera-outline" onPress={() => void addPacking('camera')} disabled={ui.packingUploading} />
                  <TextAction label="From your photos" icon="image-outline" onPress={() => void addPacking('library')} disabled={ui.packingUploading} />
                </View>
              )
            ) : null}
          </Card>
        ) : null}

        {/* The next moves */}
        {shownMoves.length ? (
          <View style={styles.actions}>
            {shownMoves.map((m, i) => (
              <Button
                key={m}
                label={VENDOR_STATUS_ACTION[m] ?? m}
                variant={i === 0 ? 'primary' : 'secondary'}
                loading={ui.acting !== null && ui.acting !== 'accept'}
                onPress={() =>
                  void act(
                    m === 'preparing'
                      ? { kind: 'preparing' }
                      : m === 'ready'
                        ? { kind: 'ready' }
                        : m === 'on_the_way'
                          ? { kind: 'handed-external' }
                          : m === 'picked_up'
                            ? { kind: 'picked-up' }
                            : { kind: 'delivered' },
                    ORDER_STATUS[m].vendorLabel,
                  )
                }
                fullWidth
              />
            ))}
          </View>
        ) : null}
        {canAssign && !o.rider ? <Button label="Give to a rider" leftIcon="bicycle-outline" variant={moves.length ? 'secondary' : 'primary'} onPress={pickRider} fullWidth /> : null}
        {o.rider ? (
          <Card>
            <View style={styles.head}>
              <IonIcon name="bicycle-outline" size="lg" color={colors.inkMuted} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{o.rider.name}</AppText>
                <AppText variant="small" tone="muted">
                  {riderStepLabel(o.rider.step, 'vendor')}
                </AppText>
                <AppText variant="caption" tone={o.rider.locationLive ? 'success' : 'muted'}>
                  {o.rider.locationLive ? 'Location live' : 'No live location'}
                </AppText>
              </View>
              {o.rider.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${o.rider.name}`} onPress={() => callNumber(o.rider!.phone!)} /> : null}
            </View>
            {canAssign && beforePickup ? <TextAction label="Give to another rider" icon="swap-horizontal-outline" onPress={pickRider} /> : null}
          </Card>
        ) : o.handedToExternal && !isEnded(o.status) ? (
          <InlineNotice tone="info" message="With your rider. Mark it delivered when it reaches the customer." />
        ) : null}

        {/* The customer */}
        <Card>
          <View style={styles.head}>
            <IonIcon name="person-outline" size="lg" color={colors.inkMuted} />
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
              {o.distanceKm !== null ? <AppText variant="caption" tone="muted">{`${o.distanceKm} km away`}</AppText> : null}
              {a.lat !== null && a.lng !== null ? <TextAction label="Directions" icon="navigate-outline" onPress={() => navigateTo(a.lat!, a.lng!)} /> : null}
            </>
          ) : null}
        </Card>

        {/* What to cook */}
        <Card>
          <AppText variant="title">{itemsLabel(o.items.reduce((n, i) => n + i.quantity, 0))}</AppText>
          {o.items.map(i => (
            <View key={i.id} style={styles.grow}>
              <View style={styles.row}>
                <AppText variant="bodyStrong" style={styles.grow}>{`${i.quantity} × ${i.name}`}</AppText>
                <AppText variant="body">{formatPKR(i.lineTotal)}</AppText>
              </View>
              {i.variant || i.options.length ? (
                <AppText variant="small" tone="muted">
                  {[i.variant, i.options.map(x => x.name).join(', ')].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
              {i.notes ? <AppText variant="small" tone="accentDeep">{`“${i.notes}”`}</AppText> : null}
            </View>
          ))}
          {o.note ? <InlineNotice tone="info" message={`From the customer: ${o.note}`} /> : null}
          <AppText variant="small" tone={o.cutlery ? 'accentDeep' : 'muted'}>
            {o.cutlery ? 'Send cutlery' : 'No cutlery'}
          </AppText>
        </Card>

        {/* The money (all of it the kitchen's) */}
        <Card>
          <View style={styles.row}>
            <AppText variant="title">{PAYMENT_METHOD[o.payment.method].label}</AppText>
            {pay.vendorLabel !== PAYMENT_METHOD[o.payment.method].label ? <StatusPill label={pay.vendorLabel} tone={pillTone(pay.tone)} /> : null}
          </View>
          <View style={styles.row}>
            <AppText variant="body" tone="muted">
              Subtotal
            </AppText>
            <AppText variant="body">{formatPKR(o.totals.subtotal)}</AppText>
          </View>
          {o.totals.discount ? (
            <View style={styles.row}>
              <AppText variant="body" tone="muted">
                {o.deal?.code ? `Code ${o.deal.code}` : (o.deal?.title ?? 'Your deal')}
              </AppText>
              <AppText variant="body">{`− ${formatPKR(o.totals.discount)}`}</AppText>
            </View>
          ) : null}
          {o.fulfilment === 'delivery' ? (
            <View style={styles.row}>
              <AppText variant="body" tone="muted">
                Delivery
              </AppText>
              <AppText variant="body">{o.totals.deliveryFee ? formatPKR(o.totals.deliveryFee) : 'Free'}</AppText>
            </View>
          ) : null}
          <View style={styles.row}>
            <AppText variant="title">{o.payment.method === 'cod' ? 'Collect' : o.payment.method === 'pay_at_pickup' ? 'Collect at the counter' : 'Total'}</AppText>
            <AppText variant="title">{formatPKR(o.totals.total)}</AppText>
          </View>
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
          {o.actions.payment.includes('paid') ? (
            <Button label="The money is in our account" loading={ui.acting === 'confirm-payment'} onPress={() => void act({ kind: 'confirm-payment' }, 'Payment confirmed')} fullWidth />
          ) : null}
          {o.actions.payment.includes('awaiting_transfer') ? <Button label="Not received" variant="secondary" onPress={() => dispatch(setReasonSheet('reject-payment'))} fullWidth /> : null}
          {o.payment.status === 'refund_due' ? <InlineNotice tone="warning" message={`You owe the customer ${formatPKR(o.totals.total)} back for this transfer.`} /> : null}
          <AppText variant="caption" tone="muted">
            The customer pays you directly. MetroMatrix takes no commission.
          </AppText>
        </Card>

        {/* What happened */}
        <Card>
          <AppText variant="title">History</AppText>
          {o.events.map((e, i) => (
            <View key={`${e.at}-${i}`} style={styles.event}>
              <AppText variant="caption" tone="muted">
                {formatSlot(e.at, TZ)}
              </AppText>
              <AppText variant="small" style={styles.grow}>
                {e.kind === 'payment'
                  ? `Payment: ${PAYMENT_STATUS[e.to as keyof typeof PAYMENT_STATUS]?.vendorLabel ?? e.to}`
                  : e.kind === 'rider'
                    ? riderStepLabel(e.to ?? '', 'vendor')
                    : (ORDER_STATUS[e.to as FoodOrderStatus]?.vendorLabel ?? e.to ?? '')}
                {e.note && e.kind !== 'payment' ? ` · ${e.to === 'rejected' ? rejectReasonLabel(e.note) : e.note}` : ''}
              </AppText>
            </View>
          ))}
        </Card>

        {o.actions.status.includes('cancelled') ? <Button label="Cancel order" variant="destructive" onPress={() => dispatch(setReasonSheet('cancel'))} fullWidth /> : null}
      </View>

      <Sheet visible={ui.assignOpen} onClose={() => dispatch(setAssignOpen(false))} title="Give to a rider" subtitle="Your riders on duty: fewest deliveries first, then nearest.">
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {ui.suggestStatus === 'loading' && !ui.suggestions.length ? <SkeletonLines lines={3} /> : null}
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
              r.distanceKm !== null ? `${r.distanceKm} km away` : r.locationLive ? null : 'No live location',
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
        onClose={() => dispatch(setReasonSheet(null))}
        title={ui.sheet === 'reject' ? `Decline ${o.code}?` : ui.sheet === 'cancel' ? `Cancel ${o.code}?` : 'Transfer not received'}
        subtitle={
          ui.sheet === 'reject-payment'
            ? 'The customer is told why and gets 10 more minutes to send it.'
            : ui.sheet === 'cancel' && o.payment.status === 'paid'
              ? 'They paid by transfer: you’ll owe them a refund.'
              : 'The customer is told why.'
        }
      >
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {(ui.sheet === 'reject' ? REJECT_REASONS.map(r => ({ key: r.key, label: r.label })) : (ui.sheet === 'cancel' ? VENDOR_CANCEL_REASONS : PAYMENT_REJECT_REASONS).map(r => ({ key: r, label: r }))).map(r => (
          <ChoiceLine
            key={r.key}
            label={r.label}
            price={null}
            selected={false}
            multiple={false}
            disabled={ui.acting !== null}
            onPress={() =>
              void act(
                ui.sheet === 'reject' ? { kind: 'reject', reason: r.key } : ui.sheet === 'cancel' ? { kind: 'cancel', reason: r.key } : { kind: 'reject-payment', reason: r.key },
                ui.sheet === 'reject' ? 'Declined' : ui.sheet === 'cancel' ? 'Cancelled' : 'The customer has been told',
              )
            }
          />
        ))}
        <Button label="Go back" variant="secondary" onPress={() => dispatch(setReasonSheet(null))} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default VendorOrderScreen;
