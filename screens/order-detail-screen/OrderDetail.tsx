// ═══════════════════════════════════════════════════════
// MetroMatrix — An order (one checkout, one part per store)
// ═══════════════════════════════════════════════════════
// Each store's part moves on its own, in one card: its head row with ONE
// pill (what the customer owes comes before where the parcel is), how to pay
// it (a transfer the store is waiting for comes first), tracking and its
// journey, its items (review each once delivered), what it came to, and only
// the actions the server allows now: at most one button and one secondary,
// the rest (cancel, ask to cancel, the store's WhatsApp and phone) as links.

import React, { useCallback } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { formatAddress } from '../../models/addressModel';
import { needsPayment, PAYMENT_METHOD_LABEL, storeOrderHeadline } from '../../models/shopping/orderStatusModel';
import { returnDaysLeft } from '../../models/shopping/returnFormModel';
import { whatsappUrl } from '../../models/shopping/storePolicyModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BagGroupSkeleton,
  Button,
  Card,
  ChoiceChip,
  Divider,
  InlineNotice,
  IonIcon,
  LineItemRow,
  MoneyRows,
  OrderTimeline,
  PaymentInstructionsCard,
  SectionCard,
  Sheet,
  StatusPill,
  StoreHeadRow,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { SectionError, ShopTopBar } from '../../Components/shopping/ShopParts';
import type { OrdersStackParamList, StoreOrder } from '../../models';
import { formatDateTime } from '../../utils/dates/dates';
import { haptics } from '../../utils/haptics/haptics';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { Alert } from '../../utils/alert/alert';
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

const makeStyles = ({ colors, space, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingTop: space.s20, paddingBottom: space.s40, gap: space.s16 },
    grow: { flex: 1, gap: space.s4 },
    actions: { gap: space.s8 },
    links: { flexDirection: 'row', columnGap: space.s16, flexWrap: 'wrap' },
    tracking: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const OrderDetail: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <OrderDetailContent {...props} />
  </ServiceScope>
);

const OrderDetailContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'ShopTabs', params: { screen: 'ShopOrdersTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
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
    const head = storeOrderHeadline(o);
    const hasLinks = o.canCancel || o.canRequestCancel || !!o.store.whatsapp || !!o.store.phone;
    return (
      <Card key={o.id} selected={owed}>
        <StoreHeadRow store={o.store} meta={o.code} trailing={<StatusPill label={head.label} tone={head.tone} />} />
        <AppText variant="small" tone="muted">
          {o.status === 'cancelled' && o.cancelReason ? `Cancelled: ${o.cancelReason}` : head.description}
        </AppText>

        {o.paymentInstructions && o.paymentMethod === 'transfer' && o.status !== 'cancelled' ? (
          <>
            <Divider />
            <PaymentInstructionsCard
              embedded
              instructions={o.paymentInstructions}
              status={o.paymentStatus}
              proof={o.paymentProof}
              onPaid={owed ? () => navigation.navigate('PaymentProof', { orderId: o.id, groupCode }) : undefined}
            />
          </>
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

        <Divider />
        {o.items.map((it, i) => (
          <React.Fragment key={it.id}>
            {i > 0 ? <Divider /> : null}
            <LineItemRow
              imageUrl={it.imageUrl}
              name={it.name}
              meta={[it.variantLabel, `${it.quantity} × ${formatPKR(it.unitPrice)}`].filter(Boolean).join(' · ')}
              price={formatPKR(it.lineTotal)}
              priceTone="ink"
              onOpen={() => navigation.push('ProductDetail', { id: it.productId, name: it.name })}>
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
            </LineItemRow>
          </React.Fragment>
        ))}

        <MoneyRows
          rows={[
            { label: 'Items', value: o.itemsTotal },
            { label: 'Delivery', value: o.shippingFee, kind: 'free' },
            o.discount ? { label: `Coupon ${o.couponCode ?? ''}`.trim(), value: o.discount, kind: 'discount' } : null,
            { label: `Total · ${PAYMENT_METHOD_LABEL[o.paymentMethod]}`, value: o.total, kind: 'total' },
          ]}
        />
        {o.note ? (
          <AppText variant="small" tone="muted">
            Your note: {o.note}
          </AppText>
        ) : null}

        {o.canConfirmReceived || o.canReturn ? (
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
          </View>
        ) : null}
        {hasLinks ? (
          <View style={styles.links}>
            {o.store.whatsapp ? (
              <TextAction
                label="WhatsApp"
                icon="logo-whatsapp"
                accessibilityLabel={`WhatsApp ${o.store.name}`}
                onPress={() => void Linking.openURL(whatsappUrl(o.store.whatsapp!, `Hi, about my order ${o.code}.`))}
              />
            ) : null}
            {o.store.phone ? (
              <TextAction label="Call" icon="call-outline" accessibilityLabel={`Call ${o.store.name}`} onPress={() => void Linking.openURL(`tel:${o.store.phone}`)} />
            ) : null}
            {o.canCancel ? (
              <TextAction label="Cancel order" tone="danger" disabled={busy} onPress={() => dispatch(openCancelSheet({ orderId: o.id, kind: 'cancel' }))} />
            ) : null}
            {o.canRequestCancel ? (
              <TextAction label="Ask to cancel" tone="danger" disabled={busy} onPress={() => dispatch(openCancelSheet({ orderId: o.id, kind: 'request' }))} />
            ) : null}
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
      <ShopTopBar
        title={`Order ${groupCode}`}
        subtitle={g ? `Placed ${formatDateTime(g.createdAt)} · ${formatPKR(g.total)}` : undefined}
        onBack={back}
      />
      {!g ? (
        e.status === 'failed' ? (
          <SectionError message={e.error.message} onRetry={() => void dispatch(loadOrderGroupAsync(groupCode))} />
        ) : (
          <View style={styles.content}>
            <BagGroupSkeleton />
          </View>
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={e.status === 'loading'} onRefresh={() => void dispatch(loadOrderGroupAsync(groupCode))} tintColor={service.accent} />}>
          {a.actionError.message ? <InlineNotice message={a.actionError.message} /> : null}
          {/* What needs the customer first: a transfer a store is waiting for. */}
          {[...g.orders].sort((x, y) => Number(needsPayment(y)) - Number(needsPayment(x))).map(renderOrder)}
          <SectionCard title="Delivering to" icon="location-outline">
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{g.address.fullName}</AppText>
              <AppText variant="small" tone="muted">
                {formatAddress(g.address)} · {formatPkPhoneForDisplay(g.address.phone)}
              </AppText>
            </View>
          </SectionCard>
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

export default OrderDetail;
