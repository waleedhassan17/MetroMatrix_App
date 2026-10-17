// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one rider
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { RIDER_VEHICLES, riderStatusLabel, riderVehicleLabel } from '@models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, ListRow, ScreenShell, Sheet, SkeletonLines, StatusPill } from '@custom/index';
import { CredentialCard } from '@custom/food/CredentialCard';
import type { FoodRider, FoodVendorStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { callNumber, openWhatsApp } from '@utils/maps';
import { formatPkPhoneForDisplay } from '@utils/phone';
import {
  clearRiderCredential,
  loadRiderAsync,
  resetRiderPasswordAsync,
  saveRiderAsync,
  selectRiderDetail,
  setRiderStatusAsync,
} from './riderDetailSlice';

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
    card: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });

const RiderDetailScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RiderDetailContent {...props} />
  </ServiceScope>
);

const RiderDetailContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'RidersTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectRiderDetail);
  const r = s.rider?.id === id ? s.rider : null;

  useEffect(() => {
    void dispatch(loadRiderAsync(id));
  }, [dispatch, id]);

  if (!r) {
    return (
      <ScreenShell title="Rider" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRiderAsync(id)) }} /> : <SkeletonLines lines={6} />}
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

      <Card style={styles.card}>
        <View style={styles.head}>
          <AppText variant="title">Status</AppText>
          <StatusPill label={riderStatusLabel(r.status)} tone={r.status === 'active' ? 'success' : r.status === 'plan_locked' ? 'warning' : 'neutral'} />
        </View>
        {r.status === 'plan_locked' ? (
          <AppText variant="small" tone="muted">
            Your plan has more riders than it allows, so this rider is paused. Deactivate another rider to free a place.
          </AppText>
        ) : (
          <View style={styles.chips}>
            {STATUS_CHOICES.map(c => (
              <ChoiceChip key={c.key} label={c.label} selected={r.status === c.key} disabled={s.busy === 'status'} onPress={() => changeStatus(c.key)} />
            ))}
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Vehicle</AppText>
        <View style={styles.chips}>
          {RIDER_VEHICLES.map(v => (
            <ChoiceChip key={v.key} label={v.label} selected={r.vehicle === v.key} disabled={s.busy === 'save'} onPress={() => void dispatch(saveRiderAsync({ id, input: { vehicle: v.key } }))} />
          ))}
        </View>
      </Card>

      <Card padded="horizontal">
        {r.phone ? (
          <>
            <ListRow title={formatPkPhoneForDisplay(r.phone)} subtitle="Call" leftIcon="call-outline" onPress={() => callNumber(r.phone!)} />
            <ListRow title="WhatsApp" leftIcon="logo-whatsapp" onPress={() => openWhatsApp(r.phone!)} />
          </>
        ) : null}
        <ListRow title={r.username ?? 'No username'} subtitle="Username — riders sign in with it" leftIcon="person-outline" chevron={false} />
        <ListRow title="Reset password" subtitle="Signs them out and gives a new password" leftIcon="key-outline" onPress={reset} />
      </Card>

      <Sheet visible={!!s.credential} onClose={() => dispatch(clearRiderCredential())} title="New password" footer={<Button label="Done" variant="secondary" onPress={() => dispatch(clearRiderCredential())} fullWidth />}>
        {s.credential ? <CredentialCard riderName={r.fullName} credential={s.credential} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default RiderDetailScreen;
