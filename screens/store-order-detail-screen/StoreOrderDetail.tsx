// ═══════════════════════════════════════════════════════
// MetroMatrix — A store order (the partner's side)
// ═══════════════════════════════════════════════════════
// The FYP's process-order page, as titled cards: where it stands (ONE pill),
// a transfer to check, a refund to record, who it ships to and how they pay,
// the items and what the customer pays, shipping and notes, and the journey.
// The next step is the one big button, pinned at the foot: Confirm → Mark
// packed → Ship (courier and tracking) → Mark delivered (or, for a transfer
// waiting, "It's in my account"). Only what the server allows now is shown.
// The customer is a call or a WhatsApp away; the note is for the store only.

import React, { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { formatAddress } from '../../models/addressModel';
import { COURIERS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS, partnerHeadline } from '../../models/shopping/orderStatusModel';
import { whatsappUrl } from '../../models/shopping/storePolicyModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BagGroupSkeleton,
  Button,
  ChoiceChip,
  Divider,
  ImageViewer,
  InlineNotice,
  IonIcon,
  LineItemRow,
  MoneyRows,
  OrderTimeline,
  ScreenShell,
  SectionCard,
  Sheet,
  StatusPill,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import type { PartnerOrderAction, PartnerOrderDetail, StorePartnerStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { cdn } from '../../utils/cdn/cdn';
import { formatDateTime } from '../../utils/dates/dates';
import { haptics } from '../../utils/haptics/haptics';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay, isValidPkMobile } from '../../utils/phone/phone';
import {
  loadStoreOrderAsync,
  openStoreOrderSheet,
  saveNoteAsync,
  selectStoreOrder,
  selectStoreOrderUi,
  setCourier,
  setInternalNote,
  setOrderRefundAmount,
  setOrderRefundReference,
  setRiderName,
  setRiderPhone,
  setStoreOrderReason,
  setTrackingRef,
  storeOrderActionAsync,
  type StoreOrderActionInput,
} from './storeOrderDetailSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'StoreOrderDetail'>;

/** The one next step, in order of the journey. */
const NEXT: { action: PartnerOrderAction; label: string }[] = [
  { action: 'approve_cancellation', label: 'Approve cancellation' },
  { action: 'confirm', label: 'Confirm order' },
  { action: 'pack', label: 'Mark as packed' },
  { action: 'ship', label: 'Ship it' },
  { action: 'deliver', label: 'Mark as delivered' },
  { action: 'cash_collected', label: 'Cash collected' },
];

const DONE: Partial<Record<PartnerOrderAction, string>> = {
  confirm: 'Order confirmed. The customer has been told.',
  pack: 'Marked as packed',
  ship: 'Shipped. The customer has the tracking number.',
  deliver: 'Marked as delivered',
  cancel: 'Order cancelled. Stock is back.',
  approve_cancellation: 'Cancelled as the customer asked. Stock is back.',
  confirm_payment: 'Payment confirmed. You can ship it now.',
  reject_payment: 'The customer has been asked to check their transfer.',
  cash_collected: 'Cash recorded',
  refund: 'Refund recorded. The customer has been told.',
};

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    contact: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    proof: { width: size.tile * 2, aspectRatio: size.productAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    scroll: { gap: space.s16, paddingBottom: space.s40 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    cancel: { alignSelf: 'center' },
  });

const StoreOrderDetail: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreOrderDetailContent {...props} />
  </ServiceScope>
);

const StoreOrderDetailContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'OrdersTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, service, rowTint } = useTheme();
  const { id } = route.params;
  const e = useAppSelector(s => selectStoreOrder(s, id));
  const ui = useAppSelector(selectStoreOrderUi);
  const [proofOpen, setProofOpen] = useState(false);
  const o = e.order;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadStoreOrderAsync(id));
    }, [dispatch, id]),
  );

  const run = async (input: StoreOrderActionInput) => {
    const r = await dispatch(storeOrderActionAsync({ id, input }));
    if (storeOrderActionAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: DONE[input.action] ?? 'Done' });
    } else haptics.warning();
  };

  const confirmThen = (title: string, body: string, input: StoreOrderActionInput) =>
    Alert.alert(title, body, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Yes', onPress: () => void run(input) },
    ]);

  const next = o ? NEXT.find(n => o.allowedActions.includes(n.action)) : undefined;
  const can = (a: PartnerOrderAction) => !!o?.allowedActions.includes(a);
  // A transfer waiting to be checked comes first at the foot.
  const checkProof = !!o && o.paymentStatus === 'proof_submitted' && !!o.paymentProof && can('confirm_payment');

  const onNext = () => {
    if (!o || !next) return;
    if (next.action === 'ship') dispatch(openStoreOrderSheet('ship'));
    else if (next.action === 'deliver') confirmThen('Mark as delivered?', `Only once ${o.customer.name} has it.`, { action: 'deliver' });
    else if (next.action === 'cash_collected') confirmThen('Cash collected?', `${formatPKR(o.total)} from ${o.customer.name}.`, { action: 'cash_collected' });
    else void run({ action: next.action } as StoreOrderActionInput);
  };

  const renderBody = (order: PartnerOrderDetail) => {
    const head = partnerHeadline(order);
    const pay = PAYMENT_STATUS[order.paymentStatus];
    const proof = order.paymentProof;
    return (
      <>
        <SectionCard title="Order status" subtitle={`Placed ${formatDateTime(order.createdAt)}`} action={<StatusPill label={head.label} tone={head.tone} />}>
          <AppText variant="small" tone="muted">
            {head.description}
          </AppText>
        </SectionCard>
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {order.status === 'cancellation_requested' ? (
          <InlineNotice
            tone="warning"
            title="The customer asked to cancel"
            message={order.events.filter(ev => ev.type === 'cancellation_requested').pop()?.note ?? 'No reason given.'}
          />
        ) : null}
        {order.shipBlockedReason ? <InlineNotice tone="warning" title="Not ready to ship" message={order.shipBlockedReason} /> : null}

        {order.paymentStatus === 'proof_submitted' && proof ? (
          <SectionCard title="Check this transfer" subtitle="Confirm only once you see it in your own account." icon="card-outline" tint={rowTint.amber} selected>
            <View style={styles.row}>
              <View style={styles.grow}>
                <AppText variant="h2">{formatPKR(order.total)}</AppText>
                <AppText variant="small" tone="muted">
                  Transaction <AppText variant="small">{proof.transactionId}</AppText>
                </AppText>
                <AppText variant="caption" tone="muted">
                  Sent {formatDateTime(proof.submittedAt)}
                </AppText>
              </View>
              {proof.imageUrl ? (
                <Pressable onPress={() => setProofOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Open the receipt">
                  <Image source={{ uri: cdn(proof.imageUrl, { w: size.tile * 2 }) ?? undefined }} style={styles.proof} contentFit="cover" />
                </Pressable>
              ) : null}
            </View>
          </SectionCard>
        ) : null}

        {can('refund') ? (
          <SectionCard
            title="Record the refund you sent"
            subtitle={`${order.customer.name} paid ${formatPKR(order.total)} before the order was cancelled. Send it back, then note it here.`}
            icon="cash-outline"
            tint={rowTint.amber}
            selected>
            <View style={styles.two}>
              <View style={styles.half}>
                <TextField label="Amount (Rs)" mode="numeric" value={ui.refundAmount} onChangeText={t => dispatch(setOrderRefundAmount(t))} helper={`Up to ${formatPKR(order.total)}`} />
              </View>
              <View style={styles.half}>
                <TextField label="Reference" value={ui.refundReference} onChangeText={t => dispatch(setOrderRefundReference(t))} autoCapitalize="characters" placeholder="IBFT-5521" />
              </View>
            </View>
            <Button
              label="Record refund"
              disabled={!refundOk(order.total)}
              onPress={() => void run({ action: 'refund', amount: Number(ui.refundAmount), reference: ui.refundReference })}
              loading={ui.busy === 'refund'}
              fullWidth
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Ship to" icon="location-outline" tint={rowTint.blue}>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{order.customer.name}</AppText>
            <AppText variant="small" tone="muted">
              {formatAddress(order.address)}
              {order.address.landmark ? ` · ${order.address.landmark}` : ''}
            </AppText>
            <AppText variant="small" tone="muted">
              {formatPkPhoneForDisplay(order.customer.phone)}
            </AppText>
          </View>
          <View style={styles.contact}>
            <TextAction label="Call" icon="call-outline" onPress={() => void Linking.openURL(`tel:${order.customer.phone}`)} />
            <TextAction
              label="WhatsApp"
              icon="logo-whatsapp"
              onPress={() => void Linking.openURL(whatsappUrl(order.customer.phone, `Hi ${order.customer.name}, about your order ${order.code}.`))}
            />
          </View>
          <Divider />
          <View style={styles.row}>
            <IonIcon name="wallet-outline" size="md" color={service.accentDeep} />
            <View style={styles.grow}>
              <AppText variant="overline" tone="muted">
                Payment
              </AppText>
              <AppText variant="bodyStrong">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</AppText>
            </View>
            <StatusPill label={pay.label} tone={pay.tone} />
          </View>
        </SectionCard>

        <SectionCard title={`Items (${order.items.reduce((n, it) => n + it.quantity, 0)})`} icon="bag-handle-outline" tint={rowTint.violet}>
          {order.items.map((it, i) => (
            <React.Fragment key={it.id}>
              {i > 0 ? <Divider /> : null}
              <LineItemRow
                imageUrl={it.imageUrl}
                name={it.name}
                meta={[it.variantLabel, `${it.quantity} × ${formatPKR(it.unitPrice)}`].filter(Boolean).join(' · ')}
                price={formatPKR(it.lineTotal)}
                priceTone="ink"
              />
            </React.Fragment>
          ))}
          <MoneyRows
            rows={[
              { label: 'Items', value: order.itemsTotal },
              { label: 'Delivery', value: order.shippingFee, kind: 'free' },
              order.discount ? { label: `Coupon ${order.couponCode ?? ''}`.trim(), value: order.discount, kind: 'discount' } : null,
              { label: 'Customer pays', value: order.total, kind: 'total' },
            ]}
          />
        </SectionCard>

        <SectionCard title="Shipping and notes" icon="cube-outline" tint={rowTint.grey}>
          {order.shipment ? (
            <View style={styles.row}>
              <IonIcon name="cube-outline" size="lg" color={service.accentDeep} />
              <View style={styles.grow}>
                <AppText variant="small" tone="muted">
                  {order.shipment.courierName}
                </AppText>
                <AppText variant="bodyStrong">{order.shipment.trackingRef}</AppText>
              </View>
            </View>
          ) : null}
          {order.note ? <InlineNotice embedded tone="info" title="Note from the customer" message={order.note} /> : null}
          <TextField
            label="Private note (only your store sees it)"
            value={ui.note}
            onChangeText={t => dispatch(setInternalNote(t))}
            multiline
            placeholder="Packed by Ali, fragile …"
          />
          {ui.note !== (order.internalNote ?? '') ? (
            <TextAction
              label={ui.busy === 'note' ? 'Saving…' : 'Save note'}
              icon="checkmark"
              disabled={ui.busy === 'note'}
              onPress={() => void dispatch(saveNoteAsync({ id, note: ui.note }))}
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Journey" icon="git-commit-outline" tint={rowTint.blue}>
          <OrderTimeline order={order} />
        </SectionCard>
      </>
    );
  };

  const reasonOk = ui.reason.trim().length >= 5;
  const refundOk = (total: number) => Number(ui.refundAmount) >= 1 && Number(ui.refundAmount) <= total && ui.refundReference.trim().length >= 3;
  const ownRider = ui.courier === 'own_rider';
  const shipOk = ownRider ? ui.riderName.trim().length >= 2 && isValidPkMobile(`+92${ui.riderPhone}`) : !!ui.courier && ui.trackingRef.trim().length >= 4;
  const ship = () => {
    if (!ui.courier) return;
    void run(
      ui.courier === 'own_rider'
        ? { action: 'ship', courier: 'own_rider', riderName: ui.riderName, riderPhone: `+92${ui.riderPhone}` }
        : { action: 'ship', courier: ui.courier, trackingRef: ui.trackingRef },
    );
  };

  return (
    <ScreenShell
      title={route.params.code ?? o?.code ?? 'Order'}
      subtitle={o ? `${o.customer.name} · ${formatPKR(o.total)}` : undefined}
      onBack={back}
      scroll={false}
      footer={
        o && (checkProof || next || can('cancel')) ? (
          <>
            {checkProof ? (
              <>
                <Button
                  label="It’s in my account"
                  leftIcon="checkmark-circle-outline"
                  onPress={() => void run({ action: 'confirm_payment' })}
                  loading={ui.busy === 'confirm_payment'}
                  fullWidth
                />
                <Button label="I can’t find it" variant="secondary" onPress={() => dispatch(openStoreOrderSheet('reject_payment'))} fullWidth />
              </>
            ) : next ? (
              <Button label={next.label} onPress={onNext} loading={ui.busy === next.action} fullWidth />
            ) : null}
            {can('cancel') ? (
              <View style={styles.cancel}>
                <TextAction label="Cancel this order" tone="danger" onPress={() => dispatch(openStoreOrderSheet('cancel'))} />
              </View>
            ) : null}
          </>
        ) : undefined
      }>
      {!o ? (
        e.status === 'failed' ? (
          <InlineNotice message={e.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadStoreOrderAsync(id)) }} />
        ) : (
          <BagGroupSkeleton />
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={e.status === 'loading'} onRefresh={() => void dispatch(loadStoreOrderAsync(id))} tintColor={service.accent} />}>
          {renderBody(o)}
        </ScrollView>
      )}

      <Sheet
        visible={ui.sheet === 'ship'}
        onClose={() => dispatch(openStoreOrderSheet(null))}
        title="Ship this order"
        subtitle={ownRider ? 'The customer gets your rider’s name and number.' : 'The customer gets the courier and tracking number.'}
        footer={<Button label="Mark as shipped" disabled={!shipOk} loading={ui.busy === 'ship'} onPress={ship} fullWidth />}>
        <View style={styles.chips}>
          {COURIERS.map(c => (
            <ChoiceChip key={c.key} label={c.name} selected={ui.courier === c.key} onPress={() => dispatch(setCourier(c.key))} />
          ))}
        </View>
        {ownRider ? (
          <>
            <TextField label="Rider’s name" value={ui.riderName} onChangeText={t => dispatch(setRiderName(t))} autoCapitalize="words" placeholder="Ali Raza" />
            <TextField label="Rider’s phone" mode="phone" value={ui.riderPhone} onChangeText={t => dispatch(setRiderPhone(t))} placeholder="300 1112233" />
          </>
        ) : (
          <TextField
            label="Tracking number"
            value={ui.trackingRef}
            onChangeText={t => dispatch(setTrackingRef(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="TCS-778812"
          />
        )}
      </Sheet>

      <Sheet
        visible={ui.sheet === 'cancel' || ui.sheet === 'reject_payment'}
        onClose={() => dispatch(openStoreOrderSheet(null))}
        title={ui.sheet === 'cancel' ? 'Cancel this order?' : 'Couldn’t find the payment?'}
        subtitle={
          ui.sheet === 'cancel'
            ? 'The customer sees your reason. Stock goes back on sale.'
            : 'The customer is asked to check their transfer and send the details again (24 h more to pay).'
        }
        footer={
          <Button
            label={ui.sheet === 'cancel' ? 'Cancel order' : 'Tell the customer'}
            variant="destructive"
            disabled={!reasonOk}
            loading={ui.busy === 'cancel' || ui.busy === 'reject_payment'}
            onPress={() => void run({ action: ui.sheet === 'cancel' ? 'cancel' : 'reject_payment', reason: ui.reason })}
            fullWidth
          />
        }>
        <TextField
          label="Reason"
          value={ui.reason}
          onChangeText={t => dispatch(setStoreOrderReason(t))}
          multiline
          placeholder={ui.sheet === 'cancel' ? 'Sold out in this size' : 'No transfer with this ID reached our account'}
          helper="At least 5 characters."
        />
      </Sheet>

      <ImageViewer visible={proofOpen} uri={o?.paymentProof?.imageUrl ?? null} title="Payment receipt" onClose={() => setProofOpen(false)} />
    </ScreenShell>
  );
};

export default StoreOrderDetail;
