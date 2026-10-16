// ═══════════════════════════════════════════════════════
// MetroMatrix — Availability
// ═══════════════════════════════════════════════════════
// Locations: video and each clinic, with fee and slot length (add, edit,
// remove). Weekly hours: one location's week as time ranges — add a range,
// copy a day to the weekdays, close a day — with clashes against your other
// locations named inline. Preview: your next 7 days exactly as patients see
// them.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  EmptyState,
  IconButton,
  InlineNotice,
  IonIcon,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
  ToggleRow,
} from '@custom/index';
import { SLOT_LENGTHS, WEEKDAYS, crossLocationOverlaps, overlapMessage, validateLocation, validateWeek } from '@models/health/availabilityModel';
import type { DoctorPartnerStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { formatDayChip, formatSlot } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { haptics } from '@utils/haptics';
import {
  addRange,
  chooseHoursFor,
  closeLocationSheet,
  copyDay,
  deleteLocationAsync,
  editLocation,
  loadLocationsAsync,
  loadPreviewAsync,
  openLocationSheet,
  removeRange,
  saveHoursAsync,
  saveLocationAsync,
  selectAvailability,
  setAvailabilityTab,
  setDayOpen,
  setRange,
  touchHours,
  touchLocation,
  type AvailabilityTab,
} from './availabilitySlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'Availability'>;

const TABS: { key: AvailabilityTab; label: string }[] = [
  { key: 'locations', label: 'Locations' },
  { key: 'hours', label: 'Weekly hours' },
  { key: 'preview', label: 'Preview' },
];

const makeStyles = ({ space, radius, colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    range: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16 },
    slot: { paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    previewDay: { gap: space.s8, paddingVertical: space.s8 },
  });

const AvailabilityScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <AvailabilityContent {...props} />
  </ServiceScope>
);

const AvailabilityContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const s = useAppSelector(selectAvailability);

  useEffect(() => {
    void dispatch(loadLocationsAsync());
  }, [dispatch]);
  useEffect(() => {
    if (route.params?.tab) dispatch(setAvailabilityTab(route.params.tab));
  }, [route.params?.tab, dispatch]);
  useEffect(() => {
    if (s.tab === 'preview' && !s.preview && s.previewStatus !== 'loading') void dispatch(loadPreviewAsync());
  }, [s.tab, s.preview, s.previewStatus, dispatch]);

  const form = s.sheet.form;
  const locErrors = validateLocation(form);
  const current = s.locations.find(l => l.id === s.hoursFor) ?? null;
  const weekErrors = validateWeek(s.draft);
  const clashes = s.hoursFor ? crossLocationOverlaps(s.hoursFor, s.draft, s.locations) : [];
  const allClashes = [...clashes, ...s.serverOverlaps.filter(o => !clashes.some(c => c.day === o.day && c.otherLocationName === o.otherLocationName))];

  const saveLocation = async () => {
    dispatch(touchLocation());
    if (Object.keys(locErrors).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveLocationAsync({ id: s.sheet.id, input: { ...form, city: form.city || 'Lahore' } }));
    if (saveLocationAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: s.sheet.id ? 'Location saved' : 'Location added', text2: s.sheet.id ? undefined : 'Now set its weekly hours.' });
    }
  };

  const removeLocation = () =>
    Alert.alert('Remove this location?', 'Patients will no longer see it. Booked appointments stay; move or cancel them first.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => s.sheet.id && void dispatch(deleteLocationAsync(s.sheet.id)) },
    ]);

  const saveWeek = async () => {
    dispatch(touchHours());
    if (!s.hoursFor || Object.keys(weekErrors).length || clashes.length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveHoursAsync({ id: s.hoursFor, hours: s.draft }));
    if (saveHoursAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Hours saved', text2: 'Patients see the new times now.' });
    } else haptics.warning();
  };

  const footer =
    s.tab === 'locations' ? (
      <Button label="Add a location" leftIcon="add" onPress={() => dispatch(openLocationSheet({ location: null }))} fullWidth />
    ) : s.tab === 'hours' && current ? (
      <Button label={`Save ${current.name} hours`} onPress={() => void saveWeek()} loading={s.busy === 'hours'} fullWidth />
    ) : undefined;

  return (
    <ScreenShell
      title="Availability"
      subtitle="Where you see patients, and when"
      onBack={back}
      footer={footer}
      refreshing={s.status === 'loading' && s.locations.length > 0}
      onRefresh={() => void (s.tab === 'preview' ? dispatch(loadPreviewAsync()) : dispatch(loadLocationsAsync()))}>
      <SegmentTabs options={TABS} value={s.tab} onChange={t => dispatch(setAvailabilityTab(t))} accessibilityLabel="Availability" />
      {s.error.message && !s.sheet.open && !allClashes.length ? <InlineNotice message={s.error.message} /> : null}

      {s.status !== 'succeeded' && !s.locations.length ? (
        s.status === 'failed' ? null : <SkeletonLines lines={6} />
      ) : s.tab === 'locations' ? (
        s.locations.length ? (
          s.locations.map(l => (
            <Card key={l.id} onPress={() => dispatch(openLocationSheet({ location: l }))} accessibilityLabel={`${l.name}. Edit`}>
              <View style={styles.row}>
                <IonIcon name={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
                <View style={styles.grow}>
                  <AppText variant="title">{l.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {[l.kind === 'video' ? 'From anywhere' : [l.area, l.city].filter(Boolean).join(', '), `${l.slotMinutes} min slots`, l.requiresPrepay ? 'Paid before' : null].filter(Boolean).join(' · ')}
                  </AppText>
                  <AppText variant="small">{l.hours.some(h => h.ranges.length) ? l.timings.map(t => `${t.days}: ${t.hours}`).join('\n') : 'No hours yet'}</AppText>
                </View>
                <AppText variant="bodyStrong">{formatPKR(l.fee)}</AppText>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState icon="map-pin" title="No locations yet" body="Add the clinic where you see patients, or offer video consultations from anywhere." />
        )
      ) : s.tab === 'hours' ? (
        !s.locations.length ? (
          <EmptyState icon="clock" title="Add a location first" body="Hours belong to a location." />
        ) : (
          <>
            <View style={styles.chips}>
              {s.locations.map(l => (
                <ChoiceChip key={l.id} label={l.name} icon={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} selected={l.id === s.hoursFor} onPress={() => dispatch(chooseHoursFor(l.id))} />
              ))}
            </View>
            {allClashes.length ? <InlineNotice tone="warning" title="These hours overlap another location" message={allClashes.map(overlapMessage).join('\n')} /> : null}
            {WEEKDAYS.map(w => {
              const d = s.draft.find(x => x.day === w.day) ?? { day: w.day, ranges: [] };
              const open = d.ranges.length > 0;
              const clash = allClashes.find(c => c.day === w.day);
              return (
                <Card key={w.day}>
                  <View style={styles.dayHead}>
                    <AppText variant="title">{w.long}</AppText>
                    <ToggleRow label={open ? 'Open' : 'Closed'} value={open} onChange={v => dispatch(setDayOpen({ day: w.day, open: v }))} />
                  </View>
                  {d.ranges.map((r, i) => (
                    <View key={i} style={styles.range}>
                      <View style={styles.grow}>
                        <TextField
                          label="From"
                          value={r.from}
                          onChangeText={t => dispatch(setRange({ day: w.day, index: i, field: 'from', value: t }))}
                          placeholder="17:00"
                          maxLength={5}
                          keyboardType="numbers-and-punctuation"
                          error={s.touchedHours ? weekErrors[`day.${w.day}.${i}`] : undefined}
                        />
                      </View>
                      <View style={styles.grow}>
                        <TextField label="To" value={r.to} onChangeText={t => dispatch(setRange({ day: w.day, index: i, field: 'to', value: t }))} placeholder="21:00" maxLength={5} keyboardType="numbers-and-punctuation" />
                      </View>
                      <IconButton icon="close" tone="muted" onPress={() => dispatch(removeRange({ day: w.day, index: i }))} accessibilityLabel={`Remove ${w.long} range ${i + 1}`} />
                    </View>
                  ))}
                  {clash ? (
                    <AppText variant="small" tone="warning">
                      {overlapMessage(clash)}
                    </AppText>
                  ) : null}
                  {open ? (
                    <View style={styles.links}>
                      <TextAction label="Add hours" icon="add" onPress={() => dispatch(addRange(w.day))} />
                      {w.day <= 6 ? <TextAction label="Copy to Mon – Sat" icon="copy-outline" onPress={() => dispatch(copyDay(w.day))} /> : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
            <AppText variant="small" tone="muted">
              {current ? `Times are in Pakistan time, cut into ${current.slotMinutes}-minute slots. Patients can't book less than your shortest notice ahead.` : ''}
            </AppText>
          </>
        )
      ) : s.previewStatus === 'loading' || !s.preview ? (
        <SkeletonLines lines={8} />
      ) : (
        s.preview.locations.map(l => (
          <Card key={l.id}>
            <View style={styles.row}>
              <IonIcon name={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
              <AppText variant="title" style={styles.grow}>
                {l.name}
              </AppText>
            </View>
            {l.days.map((d, i) => {
              const chip = formatDayChip(d.date);
              return (
                <View key={d.date}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.previewDay}>
                    <AppText variant="bodyStrong">{chip.long}</AppText>
                    {d.slots.length ? (
                      <View style={styles.chips}>
                        {d.slots.map(t => (
                          <View key={t} style={styles.slot}>
                            <AppText variant="small">{formatSlot(t, l.timezone)}</AppText>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <AppText variant="small" tone="muted">
                        No times
                      </AppText>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        ))
      )}

      <Sheet
        visible={s.sheet.open}
        onClose={() => dispatch(closeLocationSheet())}
        title={s.sheet.id ? 'Edit location' : 'Add a location'}
        footer={
          <>
            <Button label="Save location" onPress={() => void saveLocation()} loading={s.busy === 'location'} fullWidth />
            {s.sheet.id ? <Button label="Remove location" variant="ghost" onPress={removeLocation} loading={s.busy === 'delete'} fullWidth /> : null}
          </>
        }>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        <View style={styles.chips}>
          <ChoiceChip label="Clinic" icon="business-outline" selected={form.kind === 'clinic'} onPress={() => dispatch(editLocation({ kind: 'clinic', name: form.kind === 'video' ? '' : form.name, requiresPrepay: false }))} />
          <ChoiceChip label="Video" icon="videocam-outline" selected={form.kind === 'video'} onPress={() => dispatch(editLocation({ kind: 'video', name: form.name || 'Video consultation' }))} />
        </View>
        <TextField label={form.kind === 'video' ? 'Name' : 'Clinic or hospital'} value={form.name} onChangeText={t => dispatch(editLocation({ name: t }))} error={s.sheet.touched ? locErrors.name : undefined} />
        {form.kind === 'clinic' ? (
          <>
            <TextField label="Area" value={form.area} onChangeText={t => dispatch(editLocation({ area: t }))} error={s.sheet.touched ? locErrors.area : undefined} placeholder="Gulberg III" />
            <TextField label="City" value={form.city} onChangeText={t => dispatch(editLocation({ city: t }))} error={s.sheet.touched ? locErrors.city : undefined} placeholder="Lahore" />
            <TextField label="Address" value={form.address ?? ''} onChangeText={t => dispatch(editLocation({ address: t || null }))} multiline placeholder="42-B Main Boulevard" />
            <TextField label="Clinic phone" mode="phone" value={(form.phone ?? '').replace(/^\+92/, '')} onChangeText={v => dispatch(editLocation({ phone: v ? `+92${v}` : null }))} />
          </>
        ) : (
          <ToggleRow label="Payment before the consultation" helper="Patients transfer the fee to your payment account first." value={form.requiresPrepay} onChange={v => dispatch(editLocation({ requiresPrepay: v }))} />
        )}
        <TextField
          label="Fee (Rs)"
          value={form.fee ? String(form.fee) : ''}
          onChangeText={t => dispatch(editLocation({ fee: Number(t.replace(/\D/g, '')) || 0 }))}
          keyboardType="number-pad"
          error={s.sheet.touched ? locErrors.fee : undefined}
        />
        <AppText variant="label">Slot length</AppText>
        <View style={styles.chips}>
          {SLOT_LENGTHS.map(m => (
            <ChoiceChip key={m} label={`${m} min`} selected={form.slotMinutes === m} onPress={() => dispatch(editLocation({ slotMinutes: m }))} />
          ))}
        </View>
        <TextField label="Instructions for patients (optional)" value={form.instructions ?? ''} onChangeText={t => dispatch(editLocation({ instructions: t || null }))} multiline placeholder="First floor, next to the pharmacy." />
      </Sheet>
    </ScreenShell>
  );
};

export default AvailabilityScreen;
