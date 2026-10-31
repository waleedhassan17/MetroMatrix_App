// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor settings
// ═══════════════════════════════════════════════════════
// How the kitchen works: delivery and pick-up; cash (with a limit) and
// transfers; how long it takes to cook and how long an order waits for an
// answer; how far it delivers; and where it is — the address, the phone and
// a pin on the map (riders collect there, customers pick up there).

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { AUTO_REJECT_CHOICES, validateVendorSettings } from '../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, ScreenShell, SkeletonLines, TextField, ToggleRow } from '../../Custom-Components/index';
import { FoodMap } from '../../Custom-Components/food/map/FoodMap';
import type { FoodVendorStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { selectBusiness } from '../../store/authSlice';
import {
  loadVendorSettingsAsync,
  markSettingsSubmitted,
  saveVendorSettingsAsync,
  selectVendorSettings,
  setSettingsField,
  setSettingsPin,
} from './vendorSettingsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorSettings'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    pair: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
  });

/** The pin starts on Lahore until the kitchen has one. */
const LAHORE = { lat: 31.5204, lng: 74.3587 };

const VendorSettings: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorSettingsContent {...props} />
  </ServiceScope>
);

const VendorSettingsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorSettings);
  const homeKitchen = useAppSelector(selectBusiness)?.subType === 'home_kitchen';
  const f = s.form;

  useEffect(() => {
    void dispatch(loadVendorSettingsAsync());
  }, [dispatch]);

  // The picker's starting point is fixed once the form loads; the map then moves under the pin.
  const loaded = !!f;
  const startPin = useMemo(
    () => (f && f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : LAHORE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded],
  );

  if (!f) {
    return (
      <ScreenShell title="Kitchen settings" onBack={back}>
        {s.status === 'failed' ? (
          <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadVendorSettingsAsync()) }} />
        ) : (
          <SkeletonLines lines={10} />
        )}
      </ScreenShell>
    );
  }

  const errors = s.submitted ? validateVendorSettings(f) : {};
  const set = <K extends keyof typeof f>(field: K, value: (typeof f)[K]) => dispatch(setSettingsField({ field, value }));

  const save = async () => {
    dispatch(markSettingsSubmitted());
    if (Object.keys(validateVendorSettings(f)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveVendorSettingsAsync(f));
    if (saveVendorSettingsAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Settings saved' });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Kitchen settings"
      subtitle="How customers order from you"
      onBack={back}
      footer={<Button label="Save settings" onPress={() => void save()} loading={s.saving} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <Card style={styles.card}>
        <AppText variant="title">Orders</AppText>
        <ToggleRow label="Delivery" helper="Your own riders take orders to customers" value={f.acceptsDelivery} onChange={v => set('acceptsDelivery', v)} />
        <ToggleRow label="Pick-up" helper="Customers collect from your counter" value={f.acceptsPickup} onChange={v => set('acceptsPickup', v)} />
        {errors.fulfilment ? (
          <AppText variant="small" tone="danger">
            {errors.fulfilment}
          </AppText>
        ) : null}
        {homeKitchen ? (
          <ToggleRow label="Pre-orders only" helper="Customers order ahead for your pre-order slots" value={f.preorderOnly} onChange={v => set('preorderOnly', v)} />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Payment</AppText>
        <ToggleRow label="Cash on delivery" helper="And cash when customers collect" value={f.acceptsCod} onChange={v => set('acceptsCod', v)} />
        {f.acceptsCod ? (
          <TextField
            label="Cash limit (Rs)"
            value={f.codLimit}
            onChangeText={v => set('codLimit', v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            error={errors.codLimit}
            helper="Larger orders need a transfer."
          />
        ) : null}
        <ToggleRow
          label="Confirm transfers before cooking"
          helper="An order paid by transfer waits until you confirm the money arrived"
          value={f.transferConfirmBeforePrep}
          onChange={v => set('transferConfirmBeforePrep', v)}
        />
        <AppText variant="small" tone="muted">
          Transfer accounts are under More → Payment accounts. Customers pay you directly; MetroMatrix takes no commission.
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Timing</AppText>
        <TextField
          label="Usual cooking time (minutes)"
          value={f.prepMinutes}
          onChangeText={v => set('prepMinutes', v.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          error={errors.prepMinutes}
          helper="Customers see it in your delivery time."
        />
        <AppText variant="bodyStrong">An order waits for your answer for</AppText>
        <View style={styles.chips}>
          {AUTO_REJECT_CHOICES.map(m => (
            <ChoiceChip key={m} label={`${m} min`} selected={f.autoRejectMinutes === m} onPress={() => set('autoRejectMinutes', m)} />
          ))}
        </View>
        <AppText variant="small" tone="muted">
          After that it is declined for you, and the customer is told straight away.
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Delivery area</AppText>
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextField
              label="Delivers up to (km)"
              value={f.maxRadiusKm}
              onChangeText={v => set('maxRadiusKm', v.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              error={errors.maxRadiusKm}
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="Free delivery over (Rs)"
              value={f.freeDeliveryOver}
              onChangeText={v => set('freeDeliveryOver', v.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              error={errors.freeDeliveryOver}
              helper="Optional"
            />
          </View>
        </View>
        <AppText variant="small" tone="muted">
          Delivery fees by distance are under More → Delivery zones.
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Where you are</AppText>
        <TextField label="Address" value={f.addressLine} onChangeText={v => set('addressLine', v)} error={errors.addressLine} placeholder="12-C Main Boulevard" />
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextField label="Area" value={f.area} onChangeText={v => set('area', v)} error={errors.area} placeholder="Gulberg III" />
          </View>
          <View style={styles.half}>
            <TextField label="City" value={f.city} onChangeText={v => set('city', v)} error={errors.city} placeholder="Lahore" />
          </View>
        </View>
        <TextField label="Kitchen phone" value={f.phone} onChangeText={v => set('phone', v)} error={errors.phone} keyboardType="phone-pad" placeholder="0300 1234567" />
        <AppText variant="bodyStrong">Move the map so the pin sits on your kitchen</AppText>
        <FoodMap
          pins={[]}
          height={220}
          picker={{ initial: startPin, onCenterChange: p => dispatch(setSettingsPin(p)) }}
          accessibilityLabel="Map: move it so the pin marks your kitchen"
        />
        {errors.pin ? (
          <AppText variant="small" tone="danger">
            {errors.pin}
          </AppText>
        ) : null}
      </Card>
    </ScreenShell>
  );
};

export default VendorSettings;
