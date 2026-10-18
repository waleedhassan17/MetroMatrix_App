// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: one delivery
// ═══════════════════════════════════════════════════════
// One big button at a time — Accept, I'm at the kitchen, Picked up, I'm at
// the customer, Delivered — with the map, the kitchen and the customer to
// call or navigate to, what to carry, and the cash to take at the door.
// Before pickup the rider can hand it back. The screen stays awake, and the
// rider's location is shared while the delivery is open.

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useRiderChannel } from '@hooks/useFoodLive';
import { RIDER_ACTION, RIDER_DECLINE_REASONS, primaryRiderStep, riderStepLabel, waitingForKitchen } from '@models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, IconButton, InlineNotice, IonIcon, ScreenShell, Sheet, SkeletonLines, TextField } from '@custom/index';
import { ChoiceLine } from '@custom/food/ChoiceLine';
import { FoodMap } from '@custom/food/map/FoodMap';
import type { RiderStackParamList } from '@/types';
import type { RiderStepAction } from '@networks/food/rider/riderNetwork';
import { riderLocation, type RiderLocationState } from '@/services/location/riderLocation';
import { placeLine } from '@models/food/vendorModel';
import { formatSlot } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import { callNumber, navigateTo, openWhatsApp } from '@utils/maps';
import { formatPKR } from '@utils/money';
import { loadRiderDeliveriesAsync } from '../RiderDeliveries/riderHomeSlice';
import { loadRiderOrderAsync, openRiderSheet, riderDeclineAsync, riderDeliveredAsync, riderStepAsync, selectRiderOrderEntry, selectRiderOrderUi, setRiderCash } from './riderOrderSlice';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderOrder'>;

const KEEP_AWAKE_TAG = 'rider-delivery';
const STEP_PATH: Record<string, RiderStepAction> = {
  accepted_by_rider: 'accept',
  arrived_at_branch: 'arrived-branch',
  picked_up: 'picked-up',
  arrived_at_customer: 'arrived-customer',
};

const makeStyles = ({ space, gutter, radius, colors }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    map: { borderRadius: radius.lg, overflow: 'hidden' },
    cash: { padding: space.s16, borderRadius: radius.lg, gap: space.s4 },
    muted: { color: colors.inkMuted },
  });

const RiderOrderScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RiderOrderContent {...props} />
  </ServiceScope>
);

const RiderOrderContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'RiderTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
  const { order: o, status, error } = useAppSelector(st => selectRiderOrderEntry(st, id));
  const ui = useAppSelector(selectRiderOrderUi);
  const [me, setMe] = useState<RiderLocationState>(riderLocation.current);

  const refetch = useCallback(() => void dispatch(loadRiderOrderAsync(id)), [dispatch, id]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  const active = !!o && (o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'on_the_way');
  useRiderChannel(refetch, active);

  // Handed back: back to the list.
  useEffect(() => {
    if (ui.declinedId === id) {
      void dispatch(loadRiderDeliveriesAsync());
      back();
    }
  }, [ui.declinedId, id, back, dispatch]);

  // Awake and sharing location while the delivery is open.
  useEffect(() => riderLocation.subscribe(setMe), []);
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    void riderLocation.start();
    return () => {
      void riderLocation.stop();
      try {
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        /* not supported here */
      }
    };
  }, [active]);

  if (!o) {
    return (
      <ScreenShell title="Delivery" onBack={back} scroll>
        {status === 'failed' ? <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: refetch }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const primary = primaryRiderStep(o.nextSteps);
  const canDecline = o.nextSteps.includes('declined');
  const waiting = waitingForKitchen(o);
  const kitchen = o.pickup.lat !== null && o.pickup.lng !== null ? { lat: o.pickup.lat, lng: o.pickup.lng } : null;
  const drop = o.drop && o.drop.lat !== null && o.drop.lng !== null ? { lat: o.drop.lat, lng: o.drop.lng } : null;
  const goingToCustomer = o.riderStep === 'picked_up' || o.riderStep === 'arrived_at_customer';

  const step = async () => {
    if (!primary) return;
    if (primary === 'delivered') {
      if (o.cashToCollect > 0) return void dispatch(openRiderSheet({ sheet: 'deliver', cash: o.cashToCollect }));
      haptics.press();
      const r = await dispatch(riderDeliveredAsync({ id, cash: null }));
      if (riderDeliveredAsync.fulfilled.match(r)) Toast.show({ type: 'success', text1: `${o.code} delivered` });
      return;
    }
    haptics.press();
    const r = await dispatch(riderStepAsync({ id, step: STEP_PATH[primary] }));
    if (riderStepAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const cashTyped = Number(ui.cash || '0');
  const deliver = async () => {
    haptics.press();
    const r = await dispatch(riderDeliveredAsync({ id, cash: cashTyped }));
    if (riderDeliveredAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${o.code} delivered`, text2: cashTyped ? `${formatPKR(cashTyped)} is on your cash.` : undefined });
    }
  };

  return (
    <ScreenShell
      title={o.code}
      subtitle={active ? riderStepLabel(o.riderStep ?? 'assigned', 'rider') : o.statusLabel}
      onBack={back}
      scroll
      padded={false}
      refreshing={status === 'loading'}
      onRefresh={refetch}
      footer={
        active && (primary || canDecline) ? (
          <>
            {primary ? <Button label={RIDER_ACTION[primary] ?? primary} size="lg" onPress={() => void step()} loading={ui.acting !== null && ui.acting !== 'decline'} fullWidth /> : null}
            {canDecline ? <Button label="Hand it back" variant="ghost" onPress={() => dispatch(openRiderSheet({ sheet: 'decline' }))} fullWidth /> : null}
          </>
        ) : undefined
      }
    >
      <View style={styles.content}>
        {ui.actionError.message && !ui.sheet ? <InlineNotice message={ui.actionError.message} /> : null}
        {waiting ? <InlineNotice tone="info" message={`${o.pickup.name} is still cooking. Picked up opens once they mark it ready.`} /> : null}
        {active && me.mode === 'denied' ? <InlineNotice tone="warning" message="Location is off for MetroMatrix: the customer can’t see you coming." /> : null}

        {o.cashToCollect > 0 ? (
          <View style={[styles.cash, { backgroundColor: service.accentSoft }]}>
            <AppText variant="small" tone="accentDeep">
              Collect in cash
            </AppText>
            <AppText variant="h2" tone="accentDeep">
              {formatPKR(o.cashToCollect)}
            </AppText>
          </View>
        ) : (
          <InlineNotice tone="success" message={o.codCollected ? `You collected ${formatPKR(o.codCollected)}.` : 'Already paid: nothing to collect.'} />
        )}

        {active && kitchen && drop ? (
          <View style={styles.map}>
            <FoodMap
              pins={[
                { id: 'kitchen', kind: 'vendor', at: kitchen, label: o.pickup.name },
                { id: 'drop', kind: 'drop', at: drop, label: o.drop?.name ?? 'The customer' },
              ]}
              rider={me.lastFix ? { lat: me.lastFix.lat, lng: me.lastFix.lng, heading: me.lastFix.heading } : null}
              height={size.trackingMap}
              accessibilityLabel={`Map: ${o.pickup.name} and the customer`}
            />
          </View>
        ) : null}

        {/* Where to collect */}
        <Card>
          <View style={styles.head}>
            <IonIcon name="storefront-outline" size="lg" color={goingToCustomer ? colors.inkFaint : service.accentDeep} />
            <View style={styles.grow}>
              <AppText variant="small" tone="muted">
                Collect from
              </AppText>
              <AppText variant="bodyStrong">{o.pickup.name}</AppText>
              <AppText variant="small" tone="muted">
                {placeLine(o.pickup.addressLine, o.pickup.area)}
              </AppText>
              {o.readyAt ? <AppText variant="caption" tone="success">{`Ready since ${formatSlot(o.readyAt, 'Asia/Karachi')}`}</AppText> : null}
            </View>
            {o.pickup.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${o.pickup.name}`} onPress={() => callNumber(o.pickup.phone!)} /> : null}
            {kitchen ? <IconButton icon="navigate-outline" accessibilityLabel={`Directions to ${o.pickup.name}`} onPress={() => navigateTo(kitchen.lat, kitchen.lng)} /> : null}
          </View>
        </Card>

        {/* Where to drop */}
        {o.drop ? (
          <Card>
            <View style={styles.head}>
              <IonIcon name="location-outline" size="lg" color={goingToCustomer ? service.accentDeep : colors.inkFaint} />
              <View style={styles.grow}>
                <AppText variant="small" tone="muted">
                  Deliver to
                </AppText>
                <AppText variant="bodyStrong">{o.drop.name ?? 'The customer'}</AppText>
                <AppText variant="small" tone="muted">
                  {placeLine(o.drop.line1, o.drop.building, o.drop.floor, o.drop.area)}
                </AppText>
                {o.drop.landmark ? (
                  <AppText variant="small" tone="muted">
                    {o.drop.landmark}
                  </AppText>
                ) : null}
              </View>
              {o.drop.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${o.drop.name ?? 'the customer'}`} onPress={() => callNumber(o.drop!.phone!)} /> : null}
              {drop ? <IconButton icon="navigate-outline" accessibilityLabel="Directions to the customer" onPress={() => navigateTo(drop.lat, drop.lng)} /> : null}
            </View>
            {o.drop.riderInstructions ? <InlineNotice tone="info" message={o.drop.riderInstructions} /> : null}
            {o.drop.phone ? <Button label="WhatsApp the customer" variant="secondary" size="sm" leftIcon="logo-whatsapp" onPress={() => openWhatsApp(o.drop!.phone!)} /> : null}
          </Card>
        ) : null}

        {/* What to carry */}
        <Card>
          <AppText variant="title">{`${o.itemCount} ${o.itemCount === 1 ? 'item' : 'items'}`}</AppText>
          {o.items.map((i, n) => (
            <View key={`${i.name}-${n}`}>
              {n > 0 ? <Divider /> : null}
              <AppText variant="body">{`${i.quantity} × ${i.name}`}</AppText>
              {i.variant || i.options.length ? (
                <AppText variant="caption" tone="muted">
                  {[i.variant, i.options.join(', ')].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
            </View>
          ))}
          {o.note ? <AppText variant="small" tone="accentDeep">{`Note: ${o.note}`}</AppText> : null}
          <AppText variant="small" tone="muted">
            {o.cutlery ? 'Cutlery in the bag' : 'No cutlery'}
          </AppText>
        </Card>
        {o.promisedAt && active ? (
          <AppText variant="small" tone="muted">
            {`The customer expects it by ${formatSlot(o.promisedAt, 'Asia/Karachi')}.`}
          </AppText>
        ) : null}
      </View>

      <Sheet visible={ui.sheet === 'deliver'} onClose={() => dispatch(openRiderSheet({ sheet: null }))} title="Cash at the door" subtitle={`The order is ${formatPKR(o.total)}.`}>
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        <TextField label="Cash you took (Rs)" value={ui.cash} onChangeText={v => dispatch(setRiderCash(v))} keyboardType="number-pad" />
        {cashTyped !== o.cashToCollect ? (
          <AppText variant="small" tone="warning">
            {cashTyped < o.cashToCollect ? `That’s ${formatPKR(o.cashToCollect - cashTyped)} less than the order. Tell ${o.pickup.name} why.` : 'That’s more than the order.'}
          </AppText>
        ) : null}
        <Button label={`Delivered · ${formatPKR(cashTyped)} taken`} onPress={() => void deliver()} loading={ui.acting === 'delivered'} disabled={cashTyped > o.total} fullWidth />
      </Sheet>

      <Sheet visible={ui.sheet === 'decline'} onClose={() => dispatch(openRiderSheet({ sheet: null }))} title="Hand it back?" subtitle={`${o.pickup.name} gives it to another rider.`}>
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {RIDER_DECLINE_REASONS.map(r => (
          <ChoiceLine key={r} label={r} price={null} selected={false} multiple={false} disabled={ui.acting !== null} onPress={() => void dispatch(riderDeclineAsync({ id, reason: r }))} />
        ))}
        <Button label="Keep it" variant="secondary" onPress={() => dispatch(openRiderSheet({ sheet: null }))} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default RiderOrderScreen;
