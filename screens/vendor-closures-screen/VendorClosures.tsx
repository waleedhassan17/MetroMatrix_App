// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor closures
// ═══════════════════════════════════════════════════════
// Whole days the kitchen is shut (a holiday, a wedding). Opening hours don't
// change; customers just see the kitchen closed on those days.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, DateField, EmptyState, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { PKT, addDays, dateInZone, formatDayFull, todayInZone } from '../../utils/health-time/healthTime';
import { Alert } from '../../utils/alert/alert';
import {
  addClosureAsync,
  closeClosureSheet,
  loadClosuresAsync,
  markClosureSubmitted,
  openClosureSheet,
  removeClosureAsync,
  selectVendorClosures,
  setClosureField,
  validateClosure,
} from './vendorClosuresSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorClosures'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.s4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    form: { gap: space.s16 },
  });

/** "25 Dec 2026" or "25 Dec 2026 – 27 Dec 2026" (the last day closed, not the instant it ends). */
const daysLabel = (startsAt: string, endsAt: string) => {
  const first = dateInZone(startsAt, PKT);
  const last = addDays(dateInZone(endsAt, PKT), -1);
  return last > first ? `${formatDayFull(first)} – ${formatDayFull(last)}` : formatDayFull(first);
};

const VendorClosures: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorClosuresContent {...props} />
  </ServiceScope>
);

const VendorClosuresContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorClosures);
  const errors = s.submitted ? validateClosure(s.form) : {};
  const today = todayInZone(PKT);

  useEffect(() => {
    void dispatch(loadClosuresAsync());
  }, [dispatch]);

  const add = () => {
    dispatch(markClosureSubmitted());
    if (Object.keys(validateClosure(s.form)).length) return;
    void dispatch(addClosureAsync(s.form));
  };

  const remove = (id: string, label: string) =>
    Alert.alert(`Open on ${label}?`, 'Customers can order on those days again.', [
      { text: 'Keep it closed', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void dispatch(removeClosureAsync(id)) },
    ]);

  return (
    <ScreenShell
      title="Closed days"
      subtitle="Days your kitchen is shut"
      onBack={back}
      footer={<Button label="Add a closure" leftIcon="add" onPress={() => dispatch(openClosureSheet())} fullWidth />}
    >
      {s.error.message && !s.sheet ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.closures.length ? (
        <SkeletonLines lines={4} />
      ) : !s.closures.length ? (
        <EmptyState icon="calendar" title="No closed days" body="Add the days you won’t cook — a holiday or a family event. Your weekly hours stay as they are." />
      ) : (
        s.closures.map(c => {
          const label = daysLabel(c.startsAt, c.endsAt);
          return (
            <Card key={c.id} style={styles.card}>
              <View style={styles.row}>
                <AppText variant="title">{label}</AppText>
                <TextAction label="Remove" tone="danger" onPress={() => remove(c.id, label)} disabled={s.busy} />
              </View>
              {c.reason ? (
                <AppText variant="body" tone="muted">
                  {c.reason}
                </AppText>
              ) : null}
            </Card>
          );
        })
      )}

      <Sheet
        visible={s.sheet}
        onClose={() => dispatch(closeClosureSheet())}
        title="Add a closure"
        footer={<Button label="Save closure" onPress={add} loading={s.busy} fullWidth />}
      >
        <View style={styles.form}>
          <DateField label="First day closed" value={s.form.from} onChange={v => dispatch(setClosureField({ field: 'from', value: v }))} min={today} error={errors.from} />
          <DateField label="Last day closed" value={s.form.to} onChange={v => dispatch(setClosureField({ field: 'to', value: v }))} min={s.form.from || today} error={errors.to} />
          <TextField
            label="Reason (optional)"
            value={s.form.reason}
            onChangeText={v => dispatch(setClosureField({ field: 'reason', value: v }))}
            error={errors.reason}
            maxLength={200}
            placeholder="Family wedding"
          />
          {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default VendorClosures;
