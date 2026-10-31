// ═══════════════════════════════════════════════════════
// MetroMatrix — Store settings
// ═══════════════════════════════════════════════════════
// Where you deliver and what it costs, how fast you ship, your return
// window, cash on delivery (and its limit), and pausing the store. Turning
// cash on delivery off needs a payment account for transfers.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { CITIES } from '../../../../models/businessModel';
import { validateStoreSettings } from '../../../../models/shopping/storeModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField, ToggleRow } from '../../../../Custom-Components/index';
import type { StorePartnerStackParamList, StoreSettings } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { parseRupees } from '../../../../utils/money';
import { loadStoreSettingsAsync, markSettingsSubmitted, saveStoreSettingsAsync, selectStoreSettings, setSetting, toggleCity } from './storeSettingsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'StoreSettings'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const StoreSettingsScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreSettingsContent {...props} />
  </ServiceScope>
);

const StoreSettingsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectStoreSettings);
  const f = s.form;

  useEffect(() => {
    void dispatch(loadStoreSettingsAsync());
  }, [dispatch]);

  if (!f) {
    return (
      <ScreenShell title="Settings" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const errors = s.submitted ? validateStoreSettings(f, { hasActiveAccount: s.hasActiveAccount }) : {};
  const set = <K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) => dispatch(setSetting({ field, value }));
  const num = (t: string) => parseRupees(t) ?? 0;

  const save = async () => {
    dispatch(markSettingsSubmitted());
    if (Object.keys(validateStoreSettings(f, { hasActiveAccount: s.hasActiveAccount })).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveStoreSettingsAsync(f));
    if (saveStoreSettingsAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Settings saved' });
    } else haptics.warning();
  };

  return (
    <ScreenShell title="Settings" onBack={back} footer={<Button label="Save settings" onPress={() => void save()} loading={s.saveStatus === 'loading'} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <Card>
        <AppText variant="title">Delivery</AppText>
        <ToggleRow label="Deliver anywhere in Pakistan" value={f.nationwide} onChange={v => set('nationwide', v)} />
        {!f.nationwide ? (
          <>
            <AppText variant="label">Cities you deliver to</AppText>
            <View style={styles.chips}>
              {CITIES.map(c => (
                <ChoiceChip key={c.value} label={c.label} selected={f.deliveryCities.includes(c.value)} onPress={() => dispatch(toggleCity(c.value))} />
              ))}
            </View>
            {errors.deliveryCities ? (
              <AppText variant="small" tone="danger">
                {errors.deliveryCities}
              </AppText>
            ) : null}
          </>
        ) : null}
        <View style={styles.two}>
          <View style={styles.half}>
            <TextField label="Delivery fee (Rs)" mode="numeric" value={String(f.shippingFee)} onChangeText={t => set('shippingFee', num(t))} error={errors.shippingFee} />
          </View>
          <View style={styles.half}>
            <TextField
              label="Free over (Rs)"
              mode="numeric"
              value={f.freeShippingOver === null ? '' : String(f.freeShippingOver)}
              onChangeText={t => set('freeShippingOver', parseRupees(t))}
              placeholder="Never free"
              error={errors.freeShippingOver}
            />
          </View>
        </View>
        <View style={styles.two}>
          <View style={styles.half}>
            <TextField label="Ships in (min days)" mode="numeric" value={String(f.dispatchMinDays)} onChangeText={t => set('dispatchMinDays', num(t))} />
          </View>
          <View style={styles.half}>
            <TextField label="(max days)" mode="numeric" value={String(f.dispatchMaxDays)} onChangeText={t => set('dispatchMaxDays', num(t))} error={errors.dispatch} />
          </View>
        </View>
      </Card>

      <Card>
        <AppText variant="title">Returns</AppText>
        <TextField
          label="Days to return after delivery"
          mode="numeric"
          value={String(f.returnWindowDays)}
          onChangeText={t => set('returnWindowDays', Math.min(30, num(t)))}
          error={errors.returnWindowDays}
          helper="0 means no returns. At most 30."
        />
      </Card>

      <Card>
        <AppText variant="title">Payment</AppText>
        <ToggleRow label="Cash on delivery" helper="The rider collects the cash." value={f.codEnabled} onChange={v => set('codEnabled', v)} />
        {errors.codEnabled ? <InlineNotice message={errors.codEnabled} action={{ label: 'Add an account', onPress: () => navigation.navigate('PaymentAccounts') }} /> : null}
        {f.codEnabled ? (
          <TextField
            label="Cash on delivery up to (Rs)"
            mode="numeric"
            value={f.codLimit === null ? '' : String(f.codLimit)}
            onChangeText={t => set('codLimit', parseRupees(t))}
            placeholder="No limit"
            helper="Bigger orders must be paid by transfer."
            error={errors.codLimit}
          />
        ) : null}
        <TextAction label="Accounts customers pay by transfer" icon="card-outline" onPress={() => navigation.navigate('PaymentAccounts')} />
      </Card>

      <Card>
        <AppText variant="title">Take a break</AppText>
        <ToggleRow label="Pause my store" helper="Customers can browse but not order." value={f.isPaused} onChange={v => set('isPaused', v)} />
        {f.isPaused ? (
          <TextField
            label="Message to customers"
            value={f.pauseMessage ?? ''}
            onChangeText={t => set('pauseMessage', t)}
            placeholder="Back on Monday after Eid."
            error={errors.pauseMessage}
          />
        ) : null}
      </Card>
    </ScreenShell>
  );
};

export default StoreSettingsScreen;
