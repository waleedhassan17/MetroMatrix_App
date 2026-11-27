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
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  DateField,
  Divider,
  EmptyState,
  IconButton,
  InlineNotice,
  RowCardsSkeleton,
  ScreenShell,
  Sheet,
  TextField,
  TimeField,
  dateKeyOf,
} from '../../Custom-Components/index';
import { MAX_TIME_OFF_REASON, validateTimeOff } from '../../models/health/availabilityModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { formatDayFull, formatWhen } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
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

const TimeOff: React.FC<Props> = props => (
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
      { text: 'Remove', style: 'destructive', onPress: () => void dispatch(removeTimeOffAsync(id)) },
    ]);

  const label = (from: string, to: string) => (from === to ? formatDayFull(from) : `${formatDayFull(from)} – ${formatDayFull(to)}`);
  const clock = (hm: string) => {
    const [h, m] = (hm === '23:59' ? '24:00' : hm).split(':').map(Number);
    return `${h % 24 % 12 || 12}:${String(m).padStart(2, '0')} ${h % 24 < 12 ? 'AM' : 'PM'}`;
  };
  const when = (t: { from: string; to: string; hours: { from: string; to: string } | null }) =>
    t.hours ? `${formatDayFull(t.from)}, ${clock(t.hours.from)} – ${clock(t.hours.to)}` : label(t.from, t.to);
  const partDay = !!s.form.hours;

  return (
    <ScreenShell
      title="Time off"
      subtitle="Days you won't see patients"
      onBack={back}
      footer={<Button label="Add time off" leftIcon="add" onPress={() => dispatch(openTimeOffSheet(undefined))} fullWidth />}
      refreshing={s.status === 'loading' && s.items.length > 0}
      onRefresh={() => void dispatch(loadTimeOffAsync())}>
      {s.error.message && !s.sheetOpen ? (
        <InlineNotice
          message={s.error.message}
          action={s.status === 'failed' && !s.items.length ? { label: 'Try again', onPress: () => void dispatch(loadTimeOffAsync()) } : undefined}
        />
      ) : null}
      {s.status === 'loading' && !s.items.length ? (
        <RowCardsSkeleton count={3} />
      ) : s.status === 'failed' && !s.items.length ? null : s.items.length ? (
        <Card padded="horizontal">
          {s.items.map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <Divider /> : null}
              <View style={[styles.row, styles.item]}>
                <View style={styles.grow}>
                  <AppText variant="title">{when(t)}</AppText>
                  <AppText variant="small" tone="muted">
                    {[t.locationName ?? 'All locations', t.reason].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <IconButton icon="trash-outline" tone="muted" onPress={() => remove(t.id)} accessibilityLabel={`Remove time off ${when(t)}`} />
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
            {s.error.message ? <InlineNotice message={s.error.message} /> : null}
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
            <View style={styles.chips}>
              <ChoiceChip label="Whole days" icon="calendar-outline" selected={!partDay} onPress={() => dispatch(editTimeOff({ hours: null }))} />
              <ChoiceChip
                label="Some hours"
                icon="time-outline"
                selected={partDay}
                onPress={() => dispatch(editTimeOff({ hours: s.form.hours ?? { from: '14:00', to: '17:00' }, to: s.form.from }))}
              />
            </View>
            {partDay ? (
              <>
                <DateField label="Day" value={s.form.from} onChange={v => dispatch(editTimeOff({ from: v, to: v }))} min={today} error={s.touched ? errors.from : undefined} />
                <View style={styles.pair}>
                  <View style={styles.grow}>
                    <TimeField
                      label="From"
                      value={s.form.hours!.from}
                      onChange={v => dispatch(editTimeOff({ hours: { ...s.form.hours!, from: v } }))}
                      error={s.touched ? errors.hours : undefined}
                    />
                  </View>
                  <View style={styles.grow}>
                    <TimeField
                      label="To"
                      value={s.form.hours!.to === '23:59' ? '24:00' : s.form.hours!.to}
                      onChange={v => dispatch(editTimeOff({ hours: { ...s.form.hours!, to: v === '24:00' ? '23:59' : v } }))}
                      allowMidnight
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.pair}>
                <View style={styles.grow}>
                  <DateField label="First day" value={s.form.from} onChange={v => dispatch(editTimeOff({ from: v, to: s.form.to && s.form.to >= v ? s.form.to : v }))} min={today} error={s.touched ? errors.from : undefined} />
                </View>
                <View style={styles.grow}>
                  <DateField label="Last day" value={s.form.to} onChange={v => dispatch(editTimeOff({ to: v }))} min={s.form.from || today} error={s.touched ? errors.to : undefined} />
                </View>
              </View>
            )}
            <AppText variant="label">Where</AppText>
            <View style={styles.chips}>
              <ChoiceChip label="All locations" selected={!s.form.locationId} onPress={() => dispatch(editTimeOff({ locationId: null }))} />
              {s.locations.map(l => (
                <ChoiceChip key={l.id} label={l.name} selected={s.form.locationId === l.id} onPress={() => dispatch(editTimeOff({ locationId: l.id }))} />
              ))}
            </View>
            <TextField
              label="Reason (optional)"
              helper="If a booked visit is cancelled, the patient is told this reason."
              value={s.form.reason ?? ''}
              onChangeText={t => dispatch(editTimeOff({ reason: t || null }))}
              placeholder="Attending a conference"
              maxLength={MAX_TIME_OFF_REASON}
              error={s.touched ? errors.reason : undefined}
            />
          </>
        )}
      </Sheet>
    </ScreenShell>
  );
};

export default TimeOff;
