// ═══════════════════════════════════════════════════════
// MetroMatrix — A store order (the partner's side)
// ═══════════════════════════════════════════════════════
// The next step is the one big button: Confirm → Mark packed → Ship (courier
// and tracking) → Mark delivered. Only what the server allows now is shown.
// A transfer must be checked in the store's own account before it ships;
// a cancellation the customer asked for is approved here. The customer is a
// call or a WhatsApp away; the note is for the store only.

import React, { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { formatAddress } from '@models/addressModel';
import { COURIERS, ORDER_STATUS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS } from '@models/shopping/orderStatusModel';
import { whatsappUrl } from '@models/shopping/storePolicyModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  ImageViewer,
  InlineNotice,
  IonIcon,
  OrderTimeline,
  ScreenShell,
  Sheet,
  SkeletonLines,
  StatusPill,
  TextAction,
  TextField,
} from '@custom/index';
import type { PartnerOrderAction, PartnerOrderDetail, StorePartnerStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { cdn } from '@utils/cdn';
import { formatDateTime } from '@utils/dates';
import { haptics } from '@utils/haptics';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import {
  loadStoreOrderAsync,
  openStoreOrderSheet,
  saveNoteAsync,
  selectStoreOrder,
  selectStoreOrderUi,
  setCourier,
  setInternalNote,
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
};

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    pills: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    item: { flexDirection: 'row', gap: space.s12, alignItems: 'center' },
    itemWrap: { gap: space.s12 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    grow: { flex: 1, gap: space.s4 },
    contact: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    proof: { width: size.tile * 2, aspectRatio: size.productAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    scroll: { gap: space.s16, paddingBottom: space.s40 },
    actions: { gap: space.s8 },
  });

const StoreOrderDetailScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreOrderDetailContent {...props} />
  </ServiceScope>
);

const StoreOrderDetailContent: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, service } = useTheme();
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

  const onNext = () => {
    if (!o || !next) return;
    if (next.action === 'ship') dispatch(openStoreOrderSheet('ship'));
    else if (next.action === 'deliver') confirmThen('Mark as delivered?', `Only once ${o.customer.name} has it.`, { action: 'deliver' });
    else if (next.action === 'cash_collected') confirmThen('Cash collected?', `${formatPKR(o.total)} from ${o.customer.name}.`, { action: 'cash_collected' });
    else void run({ action: next.action } as StoreOrderActionInput);
  };

  const renderBody = (order: PartnerOrderDetail) => {
    const status = ORDER_STATUS[order.status];
    const pay = PAYMENT_STATUS[order.paymentStatus];
    const proof = order.paymentProof;
    return (
      <>
        <View style={styles.pills}>
          <StatusPill label={status.label} tone={status.tone} />
          <StatusPill label={pay.label} tone={pay.tone} />
        </View>
        <AppText variant="small" tone="muted">
          Placed {formatDateTime(order.createdAt)} · {PAYMENT_METHOD_LABEL[order.paymentMethod]}
        </AppText>
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
          <Card selected>
            <AppText variant="title">Check this transfer</AppText>
            <AppText variant="body">
              {formatPKR(order.total)} · transaction <AppText variant="bodyStrong">{proof.transactionId}</AppText>
            </AppText>
            <AppText variant="small" tone="muted">
              Sent {formatDateTime(proof.submittedAt)}. Confirm only once you see it in your own account.
            </AppText>
            {proof.imageUrl ? (
              <Pressable onPress={() => setProofOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Open the receipt">
                <Image source={{ uri: cdn(proof.imageUrl, { w: size.tile * 2 }) ?? undefined }} style={styles.proof} contentFit="cover" />
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Button label="It’s in my account" leftIcon="checkmark-circle-outline" onPress={() => void run({ action: 'confirm_payment' })} loading={ui.busy === 'confirm_payment'} fullWidth />
              <Button label="I can’t find it" variant="secondary" onPress={() => dispatch(openStoreOrderSheet('reject_payment'))} fullWidth />
            </View>
          </Card>
        ) : null}

        {next ? <Button label={next.label} onPress={onNext} loading={ui.busy === next.action} fullWidth /> : null}

        <Card>
          <AppText variant="title">{order.customer.name}</AppText>
          <AppText variant="small" tone="muted">
            {formatAddress(order.address)}
            {order.address.landmark ? ` · ${order.address.landmark}` : ''}
          </AppText>
          <AppText variant="small" tone="muted">
            {formatPkPhoneForDisplay(order.customer.phone)}
          </AppText>
          <View style={styles.contact}>
            <TextAction label="Call" icon="call-outline" onPress={() => void Linking.openURL(`tel:${order.customer.phone}`)} />
            <TextAction label="WhatsApp" icon="logo-whatsapp" onPress={() => void Linking.openURL(whatsappUrl(order.customer.phone, `Hi ${order.customer.name}, about your order ${order.code}.`))} />
          </View>
          {order.note ? (
            <InlineNotice tone="info" title="Note from the customer" message={order.note} />
          ) : null}
        </Card>

        <Card>
          {order.items.map((it, i) => (
            <View key={it.id} style={styles.itemWrap}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.item}>
                {it.imageUrl ? (
                  <Image source={{ uri: cdn(it.imageUrl, { w: size.thumb, h: size.thumb / size.productAspect }) ?? undefined }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={styles.thumb} />
                )}
                <View style={styles.grow}>
                  <AppText variant="small" numberOfLines={2}>
                    {it.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {[it.variantLabel, `${it.quantity} × ${formatPKR(it.unitPrice)}`].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{formatPKR(it.lineTotal)}</AppText>
              </View>
            </View>
          ))}
          <Divider />
          <View style={styles.row}>
            <AppText variant="body" tone="muted">
              Delivery
            </AppText>
            <AppText variant="body">{order.shippingFee ? formatPKR(order.shippingFee) : 'Free'}</AppText>
          </View>
          {order.discount ? (
            <View style={styles.row}>
              <AppText variant="body" tone="muted">
                Coupon {order.couponCode}
              </AppText>
              <AppText variant="body">{formatPKR(-order.discount)}</AppText>
            </View>
          ) : null}
          <View style={styles.row}>
            <AppText variant="title">Customer pays</AppText>
            <AppText variant="title">{formatPKR(order.total)}</AppText>
          </View>
        </Card>

        {order.shipment ? (
          <Card>
            <View style={styles.item}>
              <IonIcon name="cube-outline" size="lg" color={service.accentDeep} />
              <View style={styles.grow}>
                <AppText variant="small" tone="muted">
                  {order.shipment.courierName}
                </AppText>
                <AppText variant="bodyStrong">{order.shipment.trackingRef}</AppText>
              </View>
            </View>
          </Card>
        ) : null}

        <OrderTimeline order={order} />

        <TextField
          label="Private note (only your store sees it)"
          value={ui.note}
          onChangeText={t => dispatch(setInternalNote(t))}
          multiline
          placeholder="Packed by Ali, fragile …"
        />
        {ui.note !== (order.internalNote ?? '') ? (
          <Button label="Save note" variant="secondary" size="sm" onPress={() => void dispatch(saveNoteAsync({ id, note: ui.note }))} loading={ui.busy === 'note'} />
        ) : null}

        {can('cancel') ? (
          <Button label="Cancel this order" variant="ghost" onPress={() => dispatch(openStoreOrderSheet('cancel'))} fullWidth />
        ) : null}
      </>
    );
  };

  const reasonOk = ui.reason.trim().length >= 5;

  return (
    <ScreenShell title={route.params.code ?? o?.code ?? 'Order'} onBack={() => navigation.goBack()} scroll={false}>
      {!o ? (
        e.status === 'failed' ? (
          <InlineNotice message={e.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadStoreOrderAsync(id)) }} />
        ) : (
          <SkeletonLines lines={8} />
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
        subtitle="The customer gets the courier and tracking number."
        footer={
          <Button
            label="Mark as shipped"
            disabled={!ui.courier || ui.trackingRef.trim().length < 4}
            loading={ui.busy === 'ship'}
            onPress={() => ui.courier && void run({ action: 'ship', courier: ui.courier, trackingRef: ui.trackingRef })}
            fullWidth
          />
        }>
        <View style={styles.chips}>
          {COURIERS.map(c => (
            <ChoiceChip key={c.key} label={c.name} selected={ui.courier === c.key} onPress={() => dispatch(setCourier(c.key))} />
          ))}
        </View>
        <TextField
          label={ui.courier === 'own_rider' ? 'Reference (rider name or phone)' : 'Tracking number'}
          value={ui.trackingRef}
          onChangeText={t => dispatch(setTrackingRef(t))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="TCS-778812"
        />
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

export default StoreOrderDetailScreen;
