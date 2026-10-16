// ═══════════════════════════════════════════════════════
// MetroMatrix — Time off
// ═══════════════════════════════════════════════════════
// Leave, conferences, a closed clinic: those days stop taking bookings. If
// patients are already booked, you see who before deciding — and choosing
// to go ahead cancels their visits and tells them.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, ChoiceChip, DateField, Divider, EmptyState, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextField, dateKeyOf } from '@custom/index';
import { validateTimeOff } from '@models/health/availabilityModel';
import type { DoctorPartnerStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { formatDayFull, formatWhen } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import {
  addTimeOffAsync,
  closeTimeOffSheet,
  editTimeOff,
  loadTimeOffAsync,
  openTimeOffSheet,
  removeTimeOffAsync,
  selectTimeOff,
  touchTimeOff,
} from './timeOffSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'TimeOff'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    pair: { flexDirection: 'row', gap: space.s8 },
    item: { paddingVertical: space.s12 },
  });

const TimeOffScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <TimeOffContent {...props} />
  </ServiceScope>
);

const TimeOffContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectTimeOff);
  const today = dateKeyOf(new Date());
  const errors = validateTimeOff(s.form, today);

  useEffect(() => {
    void dispatch(loadTimeOffAsync());
  }, [dispatch]);
  // Opened from the calendar's "Take this day off".
  useEffect(() => {
    if (route.params?.date) dispatch(openTimeOffSheet(route.params.date));
  }, [route.params?.date, dispatch]);

  const add = async (cancelConflicts: boolean) => {
    dispatch(touchTimeOff());
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(addTimeOffAsync({ input: s.form, cancelConflicts }));
    if (addTimeOffAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Time off added', text2: cancelConflicts ? 'The booked patients have been told.' : 'Those days take no bookings now.' });
    }
  };

  const remove = (id: string) =>
    Alert.alert('Remove this time off?', 'Those days take bookings again.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', onPress: () => void dispatch(removeTimeOffAsync(id)) },
    ]);

  const label = (from: string, to: string) => (from === to ? formatDayFull(from) : `${formatDayFull(from)} – ${formatDayFull(to)}`);

  return (
    <ScreenShell
      title="Time off"
      subtitle="Days you won't see patients"
      onBack={back}
      footer={<Button label="Add time off" leftIcon="add" onPress={() => dispatch(openTimeOffSheet(undefined))} fullWidth />}
      refreshing={s.status === 'loading' && s.items.length > 0}
      onRefresh={() => void dispatch(loadTimeOffAsync())}>
      {s.error.message && !s.sheetOpen ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.items.length ? (
        <SkeletonLines lines={4} />
      ) : s.items.length ? (
        <Card padded="horizontal">
          {s.items.map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <Divider /> : null}
              <View style={[styles.row, styles.item]}>
                <View style={styles.grow}>
                  <AppText variant="title">{label(t.from, t.to)}</AppText>
                  <AppText variant="small" tone="muted">
                    {[t.locationName ?? 'All locations', t.reason].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <IconButton icon="trash-outline" tone="muted" onPress={() => remove(t.id)} accessibilityLabel={`Remove time off ${label(t.from, t.to)}`} />
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState icon="sun" title="No time off planned" body="Add leave or a closed day, and those days stop taking bookings." />
      )}

      <Sheet
        visible={s.sheetOpen}
        onClose={() => dispatch(closeTimeOffSheet())}
        title={s.conflicts.length ? 'Patients are booked on these days' : 'Add time off'}
        footer={
          s.conflicts.length ? (
            <>
              <Button label="Cancel them and tell the patients" onPress={() => void add(true)} loading={s.busy === 'add'} fullWidth />
              <Button label="Choose other days" variant="ghost" onPress={() => dispatch(editTimeOff({}))} fullWidth />
            </>
          ) : (
            <Button label="Add time off" onPress={() => void add(false)} loading={s.busy === 'add'} fullWidth />
          )
        }>
        {s.conflicts.length ? (
          <>
            <InlineNotice tone="warning" message={`${s.conflicts.length} ${s.conflicts.length === 1 ? 'visit is' : 'visits are'} booked. Going ahead cancels ${s.conflicts.length === 1 ? 'it' : 'them'}, and each patient is told and can book another time.`} />
            {s.conflicts.map(c => (
              <View key={c.id} style={styles.grow}>
                <AppText variant="bodyStrong">{c.patientName}</AppText>
                <AppText variant="small" tone="muted">{`${formatWhen(c.startAt, c.timezone)} · ${c.code}`}</AppText>
              </View>
            ))}
          </>
        ) : (
          <>
            {s.error.message ? <InlineNotice message={s.error.message} /> : null}
            <View style={styles.pair}>
              <View style={styles.grow}>
                <DateField label="First day" value={s.form.from} onChange={v => dispatch(editTimeOff({ from: v, to: s.form.to && s.form.to >= v ? s.form.to : v }))} min={today} error={s.touched ? errors.from : undefined} />
              </View>
              <View style={styles.grow}>
                <DateField label="Last day" value={s.form.to} onChange={v => dispatch(editTimeOff({ to: v }))} min={s.form.from || today} error={s.touched ? errors.to : undefined} />
              </View>
            </View>
            <AppText variant="label">Where</AppText>
            <View style={styles.chips}>
              <ChoiceChip label="All locations" selected={!s.form.locationId} onPress={() => dispatch(editTimeOff({ locationId: null }))} />
              {s.locations.map(l => (
                <ChoiceChip key={l.id} label={l.name} selected={s.form.locationId === l.id} onPress={() => dispatch(editTimeOff({ locationId: l.id }))} />
              ))}
            </View>
            <TextField label="Reason (only you see it)" value={s.form.reason ?? ''} onChangeText={t => dispatch(editTimeOff({ reason: t || null }))} placeholder="Conference" maxLength={120} />
          </>
        )}
      </Sheet>
    </ScreenShell>
  );
};

export default TimeOffScreen;
