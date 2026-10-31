// ═══════════════════════════════════════════════════════
// MetroMatrix — New coupon / edit coupon
// ═══════════════════════════════════════════════════════
// A code (or a generated one), a percentage (with an optional cap) or a
// fixed amount, an optional minimum, the dates, and how many times it can
// be used in all and per customer.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { couponValueLabel, emptyCouponForm, fromCoupon, generateCode, toCouponInput, validateCouponForm } from '../../../../models/shopping/couponFormModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, DateField, InlineNotice, ScreenShell, SegmentTabs, TextAction, TextField, ToggleRow } from '../../../../Custom-Components/index';
import type { CouponType, StorePartnerStackParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import { haptics } from '../../../../utils/haptics';
import { selectCoupons } from '../Coupons/couponsSlice';
import { deleteCouponAsync, markCouponSubmitted, saveCouponAsync, selectCouponForm, setCouponField, startCouponForm } from './couponFormSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'CouponForm'>;

const TYPES: { key: CouponType; label: string }[] = [
  { key: 'percent', label: 'Percentage' },
  { key: 'fixed', label: 'Fixed amount' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
  });

const CouponFormScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CouponFormContent {...props} />
  </ServiceScope>
);

const CouponFormContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'Coupons' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const list = useAppSelector(selectCoupons);
  const s = useAppSelector(selectCouponForm);
  const id = route.params?.id ?? null;
  const f = s.form;

  useEffect(() => {
    const existing = id ? list.coupons.find(c => c.id === id) : null;
    dispatch(startCouponForm({ id, form: existing ? fromCoupon(existing) : emptyCouponForm() }));
    // Starts once, from the list as it was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  const errors = s.submitted ? validateCouponForm(f) : {};
  const set = <K extends keyof typeof f>(field: K, value: (typeof f)[K]) => dispatch(setCouponField({ field, value }));

  const save = async () => {
    dispatch(markCouponSubmitted());
    if (Object.keys(validateCouponForm(f)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveCouponAsync({ id: s.id, form: f }));
    if (saveCouponAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Coupon saved' : `${f.code} is ready`, text2: f.isActive ? 'Customers see it at checkout.' : 'It’s off until you turn it on.' });
      back();
    } else haptics.warning();
  };

  const remove = () =>
    s.id &&
    Alert.alert(`Delete ${f.code}?`, 'Orders that used it keep their discount.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deleteCouponAsync(s.id!));
          if (deleteCouponAsync.fulfilled.match(r)) back();
        },
      },
    ]);

  const preview = f.value ? couponValueLabel({ type: f.type, value: Number(f.value) || 0, maxDiscount: toCouponInput(f).maxDiscount }) : null;

  return (
    <ScreenShell
      title={id ? 'Edit coupon' : 'New coupon'}
      onBack={back}
      footer={<Button label="Save coupon" onPress={() => void save()} loading={s.status === 'loading'} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <TextField
        label="Code"
        value={f.code}
        onChangeText={v => set('code', v)}
        error={errors.code}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="EID15"
        helper="4 to 16 letters or digits. Customers type this."
      />
      <TextAction label="Make one up for me" icon="shuffle-outline" onPress={() => set('code', generateCode())} />
      <SegmentTabs options={TYPES} value={f.type} onChange={t => set('type', t)} accessibilityLabel="Discount type" />
      <View style={styles.two}>
        <View style={styles.half}>
          <TextField label={f.type === 'percent' ? 'Percent off' : 'Rupees off'} mode="numeric" value={f.value} onChangeText={v => set('value', v)} error={errors.value} placeholder={f.type === 'percent' ? '15' : '500'} />
        </View>
        {f.type === 'percent' ? (
          <View style={styles.half}>
            <TextField label="Cap (Rs, optional)" mode="numeric" value={f.maxDiscount} onChangeText={v => set('maxDiscount', v)} error={errors.maxDiscount} placeholder="1000" />
          </View>
        ) : null}
      </View>
      <TextField label="Minimum order (Rs, optional)" mode="numeric" value={f.minOrder} onChangeText={v => set('minOrder', v)} placeholder="3000" />
      <View style={styles.two}>
        <View style={styles.half}>
          <DateField label="Starts" value={f.startsAt} onChange={v => set('startsAt', v)} error={errors.startsAt} />
        </View>
        <View style={styles.half}>
          <DateField label="Ends (optional)" value={f.endsAt} onChange={v => set('endsAt', v)} min={f.startsAt || undefined} error={errors.endsAt} />
        </View>
      </View>
      <View style={styles.two}>
        <View style={styles.half}>
          <TextField label="Uses in all" mode="numeric" value={f.usageLimit} onChangeText={v => set('usageLimit', v)} error={errors.usageLimit} placeholder="No limit" />
        </View>
        <View style={styles.half}>
          <TextField label="Per customer" mode="numeric" value={f.perCustomerLimit} onChangeText={v => set('perCustomerLimit', v)} error={errors.perCustomerLimit} placeholder="No limit" />
        </View>
      </View>
      <ToggleRow label="Active" helper="Turn off to pause it without deleting." value={f.isActive} onChange={v => set('isActive', v)} />
      {preview && f.code ? (
        <Card>
          <AppText variant="small" tone="muted">
            Customers see
          </AppText>
          <AppText variant="title">
            {f.code} · {preview}
          </AppText>
        </Card>
      ) : null}
      {s.id ? <Button label="Delete coupon" variant="ghost" onPress={() => void remove()} fullWidth /> : null}
    </ScreenShell>
  );
};

export default CouponFormScreen;
