// ═══════════════════════════════════════════════════════
// MetroMatrix — An order (one checkout, one part per store)
// ═══════════════════════════════════════════════════════
// Each store's part moves on its own: its status and journey, how to pay it
// (a transfer the store is waiting for comes first), its items (review each
// once delivered), tracking, and only the actions the server allows now
// (cancel, ask to cancel, confirm it arrived, return). The store is a call
// or a WhatsApp away.

import React, { useCallback } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { formatAddress } from '../../../../models/addressModel';
import { needsPayment, ORDER_STATUS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS } from '../../../../models/shopping/orderStatusModel';
import { returnDaysLeft } from '../../../../models/shopping/returnFormModel';
import { whatsappUrl } from '../../../../models/shopping/storePolicyModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  InlineNotice,
  IonIcon,
  OrderTimeline,
  PaymentInstructionsCard,
  Sheet,
  SkeletonLines,
  StatusPill,
  StoreMark,
  TextAction,
  TextField,
} from '../../../../Custom-Components/index';
import { SectionError, ShopTopBar } from '../../../../Components/shopping/ShopParts';
import type { OrdersStackParamList, StoreOrder } from '../../../../types';
import { cdn } from '../../../../utils/cdn';
import { formatDateTime } from '../../../../utils/dates';
import { haptics } from '../../../../utils/haptics';
import { formatPKR } from '../../../../utils/money';
import { formatPkPhoneForDisplay } from '../../../../utils/phone';
import { Alert } from '../../../../utils/alert';
import {
  CANCEL_REASONS,
  closeCancelSheet,
  loadOrderGroupAsync,
  openCancelSheet,
  orderActionAsync,
  selectOrderActions,
  selectOrderGroup,
  setCancelDetails,
  setCancelReason,
} from './orderDetailSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingTop: space.s8, paddingBottom: space.s40, gap: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1 },
    pills: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    itemWrap: { gap: space.s12 },
    item: { flexDirection: 'row', gap: space.s12 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    itemText: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    actions: { gap: space.s8 },
    contact: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    tracking: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const OrderDetailScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <OrderDetailContent {...props} />
  </ServiceScope>
);

const OrderDetailContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'ShopTabs', params: { screen: 'ShopOrdersTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size, colors, opacity } = useTheme();
  const { groupCode } = route.params;
  const e = useAppSelector(s => selectOrderGroup(s, groupCode));
  const a = useAppSelector(selectOrderActions);
  const g = e.group;

  // Fresh on every visit: the store may have moved it on.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadOrderGroupAsync(groupCode));
    }, [dispatch, groupCode]),
  );

  const run = async (kind: 'cancel' | 'request' | 'received', orderId: string, reason?: string) => {
    const r = await dispatch(orderActionAsync({ kind, orderId, reason }));
    if (orderActionAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({
        type: 'success',
        text1: kind === 'cancel' ? 'Order cancelled' : kind === 'request' ? 'Cancellation requested' : 'Thanks for confirming',
        text2: kind === 'received' ? 'You can review your items now.' : kind === 'request' ? 'The store will let you know.' : undefined,
      });
    } else haptics.warning();
  };

  const confirmReceived = (o: StoreOrder) =>
    Alert.alert(`Got your order from ${o.store.name}?`, 'Confirm only once everything has arrived.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Yes, it arrived', onPress: () => void run('received', o.id) },
    ]);

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Toast.show({ type: 'success', text1: 'Tracking number copied' });
  };

  const renderOrder = (o: StoreOrder) => {
    const busy = a.busyOrderId === o.id;
    const owed = needsPayment(o);
    const days = returnDaysLeft(o.returnWindowEndsAt);
    const status = ORDER_STATUS[o.status];
    const pay = PAYMENT_STATUS[o.paymentStatus];
    return (
      <Card key={o.id} selected={owed}>
        <View style={styles.head}>
          <StoreMark store={o.store} small />
          <View style={styles.grow}>
            <AppText variant="title" numberOfLines={1}>
              {o.store.name}
            </AppText>
            <AppText variant="caption" tone="muted">
              {o.code}
            </AppText>
          </View>
        </View>
        <View style={styles.pills}>
          <StatusPill label={status.label} tone={status.tone} />
          <StatusPill label={pay.label} tone={pay.tone} />
        </View>
        <AppText variant="small" tone="muted">
          {o.status === 'cancelled' && o.cancelReason ? `Cancelled: ${o.cancelReason}` : status.description}
        </AppText>

        {o.paymentInstructions && o.paymentMethod === 'transfer' && o.status !== 'cancelled' ? (
          <PaymentInstructionsCard
            instructions={o.paymentInstructions}
            status={o.paymentStatus}
            proof={o.paymentProof}
            onPaid={owed ? () => navigation.navigate('PaymentProof', { orderId: o.id, groupCode }) : undefined}
          />
        ) : null}

        {o.shipment ? (
          <Pressable
            onPress={() => void copy(o.shipment!.trackingRef)}
            style={({ pressed }) => [styles.tracking, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="button"
            accessibilityLabel={`Shipped with ${o.shipment.courierName}, tracking ${o.shipment.trackingRef}. Copy`}>
            <IonIcon name="cube-outline" size="lg" color={service.accentDeep} />
            <View style={styles.grow}>
              <AppText variant="small" tone="muted">
                {o.shipment.courierName}
              </AppText>
              <AppText variant="bodyStrong">{o.shipment.trackingRef}</AppText>
            </View>
            <IonIcon name="copy-outline" size="md" color={service.accentDeep} />
          </Pressable>
        ) : null}

        <OrderTimeline order={o} />

        {o.items.map((it, i) => (
          <View key={it.id} style={styles.itemWrap}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.item}>
              <Pressable onPress={() => navigation.push('ProductDetail', { id: it.productId, name: it.name })} accessibilityLabel={`Open ${it.name}`}>
                {it.imageUrl ? (
                  <Image source={{ uri: cdn(it.imageUrl, { w: size.thumb, h: size.thumb / size.productAspect }) ?? undefined }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={styles.thumb} />
                )}
              </Pressable>
              <View style={styles.itemText}>
                <AppText variant="small" numberOfLines={2}>
                  {it.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {[it.variantLabel, `${it.quantity} × ${formatPKR(it.unitPrice)}`].filter(Boolean).join(' · ')}
                </AppText>
                {o.canReview && !it.reviewed ? (
                  <TextAction
                    label="Write a review"
                    icon="star-outline"
                    onPress={() => navigation.navigate('WriteReview', { orderId: o.id, itemId: it.id, groupCode })}
                  />
                ) : it.reviewed ? (
                  <AppText variant="caption" tone="success">
                    Reviewed. Thank you.
                  </AppText>
                ) : null}
              </View>
              <AppText variant="bodyStrong">{formatPKR(it.lineTotal)}</AppText>
            </View>
          </View>
        ))}

        <Divider />
        <View style={styles.row}>
          <AppText variant="body" tone="muted">
            Items
          </AppText>
          <AppText variant="body">{formatPKR(o.itemsTotal)}</AppText>
        </View>
        <View style={styles.row}>
          <AppText variant="body" tone="muted">
            Delivery
          </AppText>
          <AppText variant="body" tone={o.shippingFee ? 'ink' : 'success'}>
            {o.shippingFee ? formatPKR(o.shippingFee) : 'Free'}
          </AppText>
        </View>
        {o.discount ? (
          <View style={styles.row}>
            <AppText variant="body" tone="muted">
              Coupon {o.couponCode}
            </AppText>
            <AppText variant="body" tone="success">
              {formatPKR(-o.discount)}
            </AppText>
          </View>
        ) : null}
        <View style={styles.row}>
          <AppText variant="title">Total · {PAYMENT_METHOD_LABEL[o.paymentMethod]}</AppText>
          <AppText variant="title">{formatPKR(o.total)}</AppText>
        </View>
        {o.note ? (
          <AppText variant="small" tone="muted">
            Your note: {o.note}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          {o.canConfirmReceived ? <Button label="I’ve received it" onPress={() => confirmReceived(o)} loading={busy} fullWidth /> : null}
          {o.canReturn ? (
            <Button
              label={days !== null && days >= 0 ? `Return items (${days === 0 ? 'last day' : `${days} days left`})` : 'Return items'}
              variant="secondary"
              leftIcon="return-down-back-outline"
              onPress={() => navigation.navigate('ReturnRequest', { orderId: o.id, groupCode })}
              fullWidth
            />
          ) : null}
          {o.canCancel ? (
            <Button label="Cancel this order" variant="ghost" onPress={() => dispatch(openCancelSheet({ orderId: o.id, kind: 'cancel' }))} disabled={busy} fullWidth />
          ) : null}
          {o.canRequestCancel ? (
            <Button label="Ask to cancel" variant="ghost" onPress={() => dispatch(openCancelSheet({ orderId: o.id, kind: 'request' }))} disabled={busy} fullWidth />
          ) : null}
        </View>
        {o.store.whatsapp || o.store.phone ? (
          <View style={styles.contact}>
            {o.store.whatsapp ? (
              <TextAction
                label={`WhatsApp ${o.store.name}`}
                icon="logo-whatsapp"
                onPress={() => void Linking.openURL(whatsappUrl(o.store.whatsapp!, `Hi, about my order ${o.code}.`))}
              />
            ) : null}
            {o.store.phone ? <TextAction label="Call" icon="call-outline" onPress={() => void Linking.openURL(`tel:${o.store.phone}`)} /> : null}
          </View>
        ) : null}
      </Card>
    );
  };

  const sheet = a.cancelSheet;
  const sheetOrder = g?.orders.find(o => o.id === sheet.orderId) ?? null;
  const reason = [sheet.reason, sheet.details.trim()].filter(Boolean).join(': ');

  return (
    <View style={styles.root}>
      <ShopTopBar title={`Order ${groupCode}`} onBack={back} />
      {!g ? (
        e.status === 'failed' ? (
          <SectionError message={e.error.message} onRetry={() => void dispatch(loadOrderGroupAsync(groupCode))} />
        ) : (
          <View style={styles.content}>
            <SkeletonLines lines={8} />
          </View>
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={e.status === 'loading'} onRefresh={() => void dispatch(loadOrderGroupAsync(groupCode))} tintColor={service.accent} />}>
          <AppText variant="small" tone="muted">
            Placed {formatDateTime(g.createdAt)} · {g.orders.length} {g.orders.length === 1 ? 'store' : 'stores'} · {formatPKR(g.total)}
          </AppText>
          {a.actionError.message ? <InlineNotice message={a.actionError.message} /> : null}
          {/* What needs the customer first: a transfer a store is waiting for. */}
          {[...g.orders].sort((x, y) => Number(needsPayment(y)) - Number(needsPayment(x))).map(renderOrder)}
          <Card>
            <View style={styles.head}>
              <IonIcon name="location-outline" size="md" color={colors.inkMuted} />
              <AppText variant="title">Delivering to</AppText>
            </View>
            <AppText variant="bodyStrong">{g.address.fullName}</AppText>
            <AppText variant="small" tone="muted">
              {formatAddress(g.address)} · {formatPkPhoneForDisplay(g.address.phone)}
            </AppText>
          </Card>
        </ScrollView>
      )}

      <Sheet
        visible={!!sheetOrder}
        onClose={() => dispatch(closeCancelSheet())}
        title={sheet.kind === 'cancel' ? 'Cancel this order?' : 'Ask the store to cancel?'}
        subtitle={
          sheet.kind === 'cancel'
            ? `${sheetOrder?.store.name ?? 'The store'} hasn't confirmed it yet, so it cancels straight away.`
            : `${sheetOrder?.store.name ?? 'The store'} has started on it. They'll decide and let you know.`
        }
        footer={
          <Button
            label={sheet.kind === 'cancel' ? 'Cancel order' : 'Send request'}
            variant="destructive"
            disabled={!sheet.reason}
            loading={a.busyOrderId === sheet.orderId}
            onPress={() => sheet.orderId && void run(sheet.kind === 'cancel' ? 'cancel' : 'request', sheet.orderId, reason)}
            fullWidth
          />
        }>
        <View style={styles.chips}>
          {CANCEL_REASONS.map(r => (
            <ChoiceChip key={r} label={r} selected={sheet.reason === r} onPress={() => dispatch(setCancelReason(r))} />
          ))}
        </View>
        <TextField label="Anything to add (optional)" value={sheet.details} onChangeText={t => dispatch(setCancelDetails(t))} maxLength={200} />
      </Sheet>
    </View>
  );
};

export default OrderDetailScreen;
