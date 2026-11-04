// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one rider
// ═══════════════════════════════════════════════════════

import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { RIDER_VEHICLES, riderDutyHeadline, riderVehicleLabel } from '../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, ScreenShell, Sheet, StatusPill, TextField, RowCardsSkeleton, SectionCard, Avatar } from '../../Custom-Components/index';
import { ToolSection } from '../../Components/admin/AdminParts';
import { CredentialCard } from '../../Custom-Components/food/CredentialCard';
import { CashLedger } from '../../Custom-Components/food/CashLedger';
import { formatPKR } from '../../utils/money/money';
import type { FoodRider, FoodVendorStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { callNumber, openWhatsApp } from '../../utils/maps/maps';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import {
  clearRiderCredential,
  loadRiderAsync,
  resetRiderPasswordAsync,
  saveRiderAsync,
  selectRiderDetail,
  setRiderStatusAsync,
  loadRiderCashAsync,
  openHandover,
  setHandoverAmount,
  setHandoverNote,
  recordHandoverAsync,
} from './riderDetailSlice';
import { ridersPlace } from '../../models/food/vendorModel';
import { selectBusiness } from '../../store/authSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorRiderDetail'>;

const STATUS_CHOICES: { key: 'active' | 'on_leave' | 'inactive'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'on_leave', label: 'On leave' },
  { key: 'inactive', label: 'Inactive' },
];

/** "On duty · 2 deliveries · Motorbike". */
const dutyLine = (r: FoodRider) =>
  [r.onDuty ? 'On duty' : 'Off duty', r.activeOrderCount ? `${r.activeOrderCount} ${r.activeOrderCount === 1 ? 'delivery' : 'deliveries'}` : null, riderVehicleLabel(r.vehicle)]
    .filter(Boolean)
    .join(' · ');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    grow: { flex: 1, gap: space.s4 },
  });

const RiderDetail: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RiderDetailContent {...props} />
  </ServiceScope>
);

const RiderDetailContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack(ridersPlace(useAppSelector(selectBusiness)?.subType === 'home_kitchen'));
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectRiderDetail);
  const r = s.rider?.id === id ? s.rider : null;

  useEffect(() => {
    void dispatch(loadRiderAsync(id));
    void dispatch(loadRiderCashAsync(id));
  }, [dispatch, id]);

  if (!r) {
    return (
      <ScreenShell title="Rider" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRiderAsync(id)) }} /> : <RowCardsSkeleton count={3} />}
      </ScreenShell>
    );
  }

  const changeStatus = (status: 'active' | 'on_leave' | 'inactive') => {
    if (status === r.status) return;
    if (status === 'inactive') {
      Alert.alert(`Deactivate ${r.fullName}?`, 'They are signed out and can’t sign in until you make them active again.', [
        { text: 'Keep active', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void dispatch(setRiderStatusAsync({ id, status })) },
      ]);
    } else void dispatch(setRiderStatusAsync({ id, status }));
  };

  const reset = () =>
    Alert.alert(`Reset ${r.fullName}'s password?`, 'They are signed out everywhere. You get a new password to send them, shown once.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset password', onPress: () => void dispatch(resetRiderPasswordAsync(id)) },
    ]);

  return (
    <ScreenShell title={r.fullName} subtitle={dutyLine(r)} onBack={back} refreshing={s.status === 'loading'} onRefresh={() => void dispatch(loadRiderAsync(id))}>
      {s.error.message && !s.credential ? <InlineNotice message={s.error.message} /> : null}

      {/* Who: the rider, and ONE pill for where they are now */}
      <Card>
        <View style={styles.identity}>
          <Avatar name={r.fullName} size="lg" />
          <View style={styles.grow}>
            <AppText variant="title" numberOfLines={1}>
              {r.fullName}
            </AppText>
            <AppText variant="small" tone="muted">
              {dutyLine(r)}
            </AppText>
          </View>
          <StatusPill label={riderDutyHeadline(r).label} tone={riderDutyHeadline(r).tone} />
        </View>
      </Card>

      <SectionCard title="Status" subtitle={r.status === 'plan_locked' ? 'Your plan has more riders than it allows, so this rider is paused. Deactivate another rider to free a place.' : undefined} icon="person-outline">
        {r.status === 'plan_locked' ? null : (
          <View style={styles.chips}>
            {STATUS_CHOICES.map(c => (
              <ChoiceChip key={c.key} label={c.label} selected={r.status === c.key} disabled={s.busy === 'status'} onPress={() => changeStatus(c.key)} />
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Vehicle" icon="bicycle-outline">
        <View style={styles.chips}>
          {RIDER_VEHICLES.map(v => (
            <ChoiceChip key={v.key} label={v.label} selected={r.vehicle === v.key} disabled={s.busy === 'save'} onPress={() => void dispatch(saveRiderAsync({ id, input: { vehicle: v.key } }))} />
          ))}
        </View>
      </SectionCard>

      <ToolSection
        title="Contact and sign-in"
        tools={[
          ...(r.phone
            ? [
                { key: 'call', title: formatPkPhoneForDisplay(r.phone), subtitle: 'Call', icon: 'call-outline' as const, tint: 'green' as const, onPress: () => callNumber(r.phone!) },
                { key: 'wa', title: 'WhatsApp', icon: 'logo-whatsapp' as const, tint: 'teal' as const, onPress: () => openWhatsApp(r.phone!) },
              ]
            : []),
          {
            key: 'user',
            title: r.username ?? 'No username',
            subtitle: 'Username — riders sign in with it. Tap to copy',
            icon: 'person-outline' as const,
            tint: 'grey' as const,
            onPress: () => {
              if (!r.username) return;
              void Clipboard.setStringAsync(r.username).then(() => Toast.show({ type: 'success', text1: 'Username copied' }));
            },
          },
          { key: 'reset', title: 'Reset password', subtitle: 'Signs them out and gives a new password', icon: 'key-outline' as const, tint: 'amber' as const, onPress: reset },
        ]}
      />

      {s.cash ? (
        <>
          <CashLedger cash={s.cash} holder={r.fullName} vendor="you" />
          {s.cash.balance > 0 ? <Button label="Record a handover" leftIcon="cash-outline" variant="secondary" onPress={() => dispatch(openHandover(true))} fullWidth /> : null}
        </>
      ) : null}

      <Sheet
        visible={s.handoverOpen}
        onClose={() => dispatch(openHandover(false))}
        title={`Cash from ${r.fullName}`}
        subtitle={s.cash ? `They hold ${formatPKR(s.cash.balance)}.` : undefined}
        footer={
          <Button
            label="Record handover"
            loading={s.handing}
            disabled={!Number(s.handoverAmount) || (!!s.cash && Number(s.handoverAmount) > s.cash.balance)}
            onPress={() => void dispatch(recordHandoverAsync({ id, amount: Number(s.handoverAmount), note: s.handoverNote.trim() || null }))}
            fullWidth
          />
        }>
        {s.handoverError.message ? <InlineNotice message={s.handoverError.message} /> : null}
        <TextField label="Amount handed over (Rs)" value={s.handoverAmount} onChangeText={v => dispatch(setHandoverAmount(v))} keyboardType="number-pad" />
        <TextField label="Note (optional)" value={s.handoverNote} onChangeText={v => dispatch(setHandoverNote(v))} placeholder="Evening handover" />
      </Sheet>

      <Sheet visible={!!s.credential} onClose={() => dispatch(clearRiderCredential())} title="New password" footer={<Button label="Done" variant="secondary" onPress={() => dispatch(clearRiderCredential())} fullWidth />}>
        {s.credential ? <CredentialCard riderName={r.fullName} credential={s.credential} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default RiderDetail;
