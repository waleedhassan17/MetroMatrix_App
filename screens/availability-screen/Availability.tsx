// ═══════════════════════════════════════════════════════
// MetroMatrix — Availability
// ═══════════════════════════════════════════════════════
// Locations: video and each clinic, with fee and slot length (add, edit,
// remove), a clinic's street address and its pin on the map. Weekly hours:
// one location's week as time ranges picked from a clock (never typed) —
// add a range, copy a day to any days, close a day — with each day's and the
// week's slot count, and clashes against your other locations named inline;
// leaving or switching with unsaved hours asks first. Preview: your next 14
// days exactly as patients see them. Every limit is the API's own and the
// server's word on a field shows under that field.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  ChoiceChip,
  DangerRow,
  Divider,
  EmptyState,
  IconButton,
  InlineNotice,
  IonIcon,
  RowCardsSkeleton,
  ScreenShell,
  SegmentTabs,
  Sheet,
  TextAction,
  TextField,
  TimeField,
  ToggleRow,
} from '../../Custom-Components/index';
import { FoodMap } from '../../Custom-Components/food/map/FoodMap';
import {
  BUFFER_CHOICES,
  LOCATION_LIMITS,
  SLOT_LENGTHS,
  WEEKDAYS,
  crossLocationOverlaps,
  daySlotCount,
  overlapMessage,
  validateLocation,
  validateWeek,
  weeklySlotCount,
} from '../../models/health/availabilityModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { selectDoctorFeatures, setAcceptingAsync } from '../../store/doctorFeaturesSlice';
import { Alert } from '../../utils/alert/alert';
import { PKT, formatDayChip, formatSlot, formatWhen } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import {
  PREVIEW_DAYS,
  addRange,
  chooseHoursFor,
  closeLocationSheet,
  copyDayTo,
  deleteLocationAsync,
  editLocation,
  loadLocationsAsync,
  loadPreviewAsync,
  openLocationSheet,
  removeRange,
  checkHoursAsync,
  saveHoursAsync,
  saveLocationAsync,
  selectAvailability,
  selectHoursDirty,
  setAvailabilityTab,
  setDayOpen,
  setPinning,
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

/** Where the map starts when a clinic has no pin yet. */
const LAHORE = { lat: 31.5204, lng: 74.3587 };

/** The app keeps the end of the day as 23:59; the clock picker calls it midnight (24:00). */
const toPicker = (hhmm: string) => (hhmm === '23:59' ? '24:00' : hhmm);
const fromPicker = (hhmm: string) => (hhmm === '24:00' ? '23:59' : hhmm);

/** "Pakistan time", or the zone's own name. */
const zoneLabel = (tz: string) => (tz === PKT ? 'Pakistan time' : tz.replace(/_/g, ' '));

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    // A location card: icon well · name and place · fee; then its facts on full-width lines.
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    well: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    fee: { alignItems: 'flex-end', gap: space.s0 },
    facts: { gap: space.s8, paddingTop: space.s12 },
    fact: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    range: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16 },
    previewDay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8, paddingVertical: space.s8 },
    list: { gap: space.s12 },
    footer: { gap: space.s8 },
  });

const Availability: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <AvailabilityContent {...props} />
  </ServiceScope>
);

const AvailabilityContent: React.FC<Props> = ({ route, navigation }) => {
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size, colors } = useTheme();
  const s = useAppSelector(selectAvailability);
  const hoursDirty = useAppSelector(selectHoursDirty);
  useUnsavedGuard(hoursDirty, s.busy === 'hours');
  // "Copy to…": the day being copied, and the days ticked.
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  useEffect(() => {
    void dispatch(loadLocationsAsync());
  }, [dispatch]);
  useEffect(() => {
    if (route.params?.tab) dispatch(setAvailabilityTab(route.params.tab));
  }, [route.params?.tab, dispatch]);
  // The preview reads again every time its tab opens (hours, time off, a day's
  // own hours or the pause may have changed since); after a failure, "Try again".
  useEffect(() => {
    if (s.tab === 'preview' && s.previewStatus !== 'loading' && s.previewStatus !== 'failed') void dispatch(loadPreviewAsync());
    // Only when the tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab, dispatch]);

  const form = s.sheet.form;
  const locErrors = validateLocation(form);
  const showLoc = (k: string) => s.sheet.serverErrors[k] ?? (s.sheet.touched ? locErrors[k] : undefined);
  const current = s.locations.find(l => l.id === s.hoursFor) ?? null;
  const weekErrors = validateWeek(s.draft, current?.slotMinutes ?? 15);
  const doctor = useAppSelector(selectDoctorFeatures);
  const has = (f: Parameters<typeof doctor.features.includes>[0]) => doctor.features.includes(f);
  // A clinic and the video consultation may share hours where the server allows it;
  // two of the same kind never can.
  const sameKind = has('cross_kind_hours') && current ? s.locations.filter(l => l.kind === current.kind) : s.locations;
  const clashes = s.hoursFor ? crossLocationOverlaps(s.hoursFor, s.draft, sameKind) : [];
  const shared =
    has('cross_kind_hours') && current && s.hoursFor
      ? crossLocationOverlaps(s.hoursFor, s.draft, s.locations.filter(l => l.kind !== current.kind))
      : [];
  const buffer = current?.bufferMinutes ?? 0;
  const sharedNames = [...new Set(shared.map(o => o.otherLocationName))];
  const allClashes = [...clashes, ...s.serverOverlaps.filter(o => !clashes.some(c => c.day === o.day && c.otherLocationName === o.otherLocationName))];
  const hasVideo = s.locations.some(l => l.kind === 'video');
  // The pin picker's start is fixed when the map opens; the map then moves under the pin.
  const pinStart = useMemo(
    () => (form.lat !== null && form.lng !== null ? { lat: form.lat, lng: form.lng } : LAHORE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.sheet.pinning, s.sheet.open],
  );

  const saveLocation = async () => {
    dispatch(touchLocation());
    if (Object.keys(locErrors).length || form.fee === null) {
      haptics.warning();
      return;
    }
    const wasNew = !s.sheet.id;
    const r = await dispatch(saveLocationAsync({ id: s.sheet.id, input: { ...form, fee: form.fee } }));
    if (saveLocationAsync.fulfilled.match(r) && !r.payload.prepayError) {
      haptics.success();
      Toast.show({
        type: 'success',
        text1: wasNew ? 'Location added' : 'Location saved',
        text2: wasNew ? 'Now set the hours patients can book there.' : undefined,
      });
    } else haptics.warning();
  };

  const saveWeek = async () => {
    dispatch(touchHours());
    if (!s.hoursFor || Object.keys(weekErrors).length || clashes.length) {
      haptics.warning();
      return;
    }
    const id = s.hoursFor;
    const commit = async () => {
      const r = await dispatch(saveHoursAsync({ id, hours: s.draft }));
      if (saveHoursAsync.fulfilled.match(r)) {
        haptics.success();
        Toast.show({ type: 'success', text1: 'Hours saved', text2: 'Patients see the new times now.' });
      } else haptics.warning();
    };
    if (!has('schedule_dry_run')) return commit();
    // Check first: booked visits these hours leave out stay booked, but the doctor should know.
    const check = await dispatch(checkHoursAsync({ id, hours: s.draft }));
    if (!checkHoursAsync.fulfilled.match(check)) {
      haptics.warning();
      return;
    }
    const outside = check.payload.outsideHours;
    if (!outside.length) return commit();
    Alert.alert(
      `${outside.length} booked ${outside.length === 1 ? 'visit falls' : 'visits fall'} outside these hours`,
      `${outside
        .slice(0, 4)
        .map(v => `${v.patientName}, ${formatWhen(v.startAt, v.timezone)}`)
        .join('\n')}${outside.length > 4 ? `\n…and ${outside.length - 4} more` : ''}\n\nThey stay booked. Move or cancel them from the calendar if you need to.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Save hours', onPress: () => void commit() },
      ],
    );
  };

  /** Switching to another location's week with unsaved hours asks first. */
  const switchHoursTo = (id: string) => {
    if (id === s.hoursFor) return;
    if (!hoursDirty) {
      dispatch(chooseHoursFor(id));
      return;
    }
    Alert.alert('Discard these hours?', `Your changes to ${current?.name ?? 'this location'} haven’t been saved.`, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => dispatch(chooseHoursFor(id)) },
    ]);
  };

  const openPaymentAccounts = () => {
    dispatch(closeLocationSheet());
    navigation.navigate('PaymentAccounts');
  };

  const footer =
    s.tab === 'locations' ? (
      <Button label="Add a location" leftIcon="add" onPress={() => dispatch(openLocationSheet({ location: null, kind: 'clinic' }))} fullWidth />
    ) : s.tab === 'hours' && current ? (
      <Button label={`Save ${current.name} hours`} onPress={() => void saveWeek()} loading={s.busy === 'hours'} disabled={!hoursDirty} fullWidth />
    ) : undefined;

  const sheetError = s.sheet.touched && Object.keys(locErrors).length ? 'Check the highlighted fields.' : s.error.message;

  return (
    <ScreenShell
      title="Availability"
      subtitle="Where you see patients, and when"
      onBack={back}
      footer={footer}
      headerContent={<SegmentTabs options={TABS} value={s.tab} onChange={t => dispatch(setAvailabilityTab(t))} accessibilityLabel="Availability" />}
      refreshing={false}
      onRefresh={() => void (s.tab === 'preview' ? dispatch(loadPreviewAsync()) : dispatch(loadLocationsAsync()))}>
      {s.error.message && !s.sheet.open && !allClashes.length ? (
        <InlineNotice
          message={s.error.message}
          action={s.status === 'failed' && !s.locations.length ? { label: 'Try again', onPress: () => void dispatch(loadLocationsAsync()) } : undefined}
        />
      ) : null}

      {s.status !== 'succeeded' && !s.locations.length ? (
        s.status === 'failed' ? null : <RowCardsSkeleton count={3} />
      ) : s.tab === 'locations' ? (
        s.locations.length ? (
          <View style={styles.list}>
            {has('pause') && doctor.isAccepting !== null ? (
              <Card>
                <ToggleRow
                  label="Taking new bookings"
                  helper={
                    doctor.isAccepting
                      ? 'Patients can book your free times.'
                      : "Paused: patients can't book you. Visits already booked stay."
                  }
                  value={doctor.isAccepting}
                  disabled={doctor.switching}
                  onChange={v => void dispatch(setAcceptingAsync(v))}
                />
                {doctor.error.message ? (
                  <AppText variant="small" tone="danger">
                    {doctor.error.message}
                  </AppText>
                ) : null}
              </Card>
            ) : null}
            {s.locations.map(l => (
              <Card key={l.id} onPress={() => dispatch(openLocationSheet({ location: l }))} accessibilityLabel={`${l.name}, ${formatPKR(l.fee)}. Edit`}>
                <View style={styles.cardHead}>
                  <View style={[styles.well, { backgroundColor: service.accentSoft }]}>
                    <IonIcon name={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="md" color={service.accentDeep} />
                  </View>
                  <View style={styles.grow}>
                    <AppText variant="title" numberOfLines={2}>
                      {l.name}
                    </AppText>
                    <AppText variant="small" tone="muted" numberOfLines={1}>
                      {l.kind === 'video' ? 'Video consultation, from anywhere' : [l.area, l.city].filter(Boolean).join(', ')}
                    </AppText>
                  </View>
                  <View style={styles.fee}>
                    <AppText variant="bodyStrong">{formatPKR(l.fee)}</AppText>
                    <AppText variant="caption" tone="muted">
                      per visit
                    </AppText>
                  </View>
                </View>
                <View style={styles.facts}>
                  <Divider />
                  <View style={styles.fact}>
                    <IonIcon name="hourglass-outline" size="sm" color={colors.inkMuted} />
                    <AppText variant="small" tone="muted" style={styles.grow}>
                      {[
                        `${l.slotMinutes}-minute visits`,
                        l.bufferMinutes ? `${l.bufferMinutes}-minute break after each` : null,
                        l.requiresPrepay ? 'paid before' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </AppText>
                  </View>
                  <View style={styles.fact}>
                    <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
                    <View style={styles.grow}>
                      {l.hours.some(h => h.ranges.length) ? (
                        l.timings.map(t => (
                          <AppText key={`${t.days}-${t.hours}`} variant="small">
                            {`${t.days} · ${t.hours}`}
                          </AppText>
                        ))
                      ) : (
                        <AppText variant="small" tone="warning">
                          {"No hours yet: patients can't book here"}
                        </AppText>
                      )}
                    </View>
                  </View>
                  <View style={styles.edit}>
                    <AppText variant="small" tone="accentDeep">
                      Edit
                    </AppText>
                    <IonIcon name="chevron-forward" size="sm" color={service.accentDeep} />
                  </View>
                </View>
              </Card>
            ))}
            {!hasVideo ? (
              <TextAction
                label="Offer video consultations too"
                icon="videocam-outline"
                onPress={() => dispatch(openLocationSheet({ location: null, kind: 'video' }))}
              />
            ) : null}
          </View>
        ) : (
          <EmptyState
            icon="location-outline"
            title="No locations yet"
            body="Add the clinic where you see patients, or offer video consultations from anywhere."
            action={{ label: 'Offer video consultations', onPress: () => dispatch(openLocationSheet({ location: null, kind: 'video' })) }}
          />
        )
      ) : s.tab === 'hours' ? (
        !s.locations.length ? (
          <EmptyState icon="time-outline" title="Add a location first" body="Hours belong to a location." action={{ label: 'Add a location', onPress: () => dispatch(setAvailabilityTab('locations')) }} />
        ) : (
          <View style={styles.list}>
            <View style={styles.chips}>
              {s.locations.map(l => (
                <ChoiceChip
                  key={l.id}
                  label={l.name}
                  icon={l.kind === 'video' ? 'videocam-outline' : 'business-outline'}
                  selected={l.id === s.hoursFor}
                  onPress={() => switchHoursTo(l.id)}
                />
              ))}
            </View>
            {current ? (
              <AppText variant="small" tone="muted">
                {`${weeklySlotCount(s.draft, current.slotMinutes, buffer)} slots a week · ${current.slotMinutes}-minute slots${buffer ? ` + ${buffer}-minute break` : ''} · ${zoneLabel(current.timezone)}`}
              </AppText>
            ) : null}
            {shared.length ? (
              <InlineNotice
                tone="info"
                title="Shared hours"
                message={`${sharedNames.join(' and ')} ${sharedNames.length === 1 ? 'is' : 'are'} open at some of these times too. Patients can book either; booking one closes the other.`}
              />
            ) : null}
            {s.hoursReport?.outsideHours.length && !hoursDirty ? (
              <InlineNotice
                tone="warning"
                title={`${s.hoursReport.outsideHours.length} booked ${s.hoursReport.outsideHours.length === 1 ? 'visit is' : 'visits are'} outside these hours`}
                message="They stay booked. Move or cancel them from the calendar if you need to."
              />
            ) : null}
            {allClashes.length ? (
              <InlineNotice tone="warning" title="These hours overlap another location" message={allClashes.map(overlapMessage).join('\n')} />
            ) : null}
            {WEEKDAYS.map(w => {
              const d = s.draft.find(x => x.day === w.day) ?? { day: w.day, ranges: [] };
              const open = d.ranges.length > 0;
              const clash = allClashes.find(c => c.day === w.day);
              const slots = current ? daySlotCount(d, current.slotMinutes, buffer) : 0;
              return (
                <Card key={w.day}>
                  <View style={styles.dayHead}>
                    <View style={styles.grow}>
                      <AppText variant="title">{w.long}</AppText>
                      <AppText variant="caption" tone="muted">
                        {open ? `${slots} ${slots === 1 ? 'slot' : 'slots'}` : 'Closed'}
                      </AppText>
                    </View>
                    <ToggleRow label={`${w.long} ${open ? 'open' : 'closed'}`} value={open} onChange={v => dispatch(setDayOpen({ day: w.day, open: v }))} />
                  </View>
                  {d.ranges.map((r, i) => (
                    <View key={i} style={styles.range}>
                      <View style={styles.grow}>
                        <TimeField
                          label={`${w.short} from`}
                          value={r.from}
                          onChange={t => dispatch(setRange({ day: w.day, index: i, field: 'from', value: t }))}
                          error={s.touchedHours ? weekErrors[`day.${w.day}.${i}`] : undefined}
                        />
                      </View>
                      <View style={styles.grow}>
                        <TimeField
                          label={`${w.short} to`}
                          value={toPicker(r.to)}
                          onChange={t => dispatch(setRange({ day: w.day, index: i, field: 'to', value: fromPicker(t) }))}
                          allowMidnight
                        />
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
                      <TextAction label="Add a break" icon="add" onPress={() => dispatch(addRange(w.day))} />
                      <TextAction
                        label="Copy to…"
                        icon="copy-outline"
                        onPress={() => {
                          setCopyTargets([]);
                          setCopyFrom(w.day);
                        }}
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })}
            <AppText variant="small" tone="muted">
              Patients book in these hours, never sooner than your shortest notice. Booked visits stay as they are when hours change.
            </AppText>
          </View>
        )
      ) : s.previewStatus === 'failed' ? (
        <InlineNotice message="The preview didn't load." action={{ label: 'Try again', onPress: () => void dispatch(loadPreviewAsync()) }} />
      ) : s.previewStatus !== 'succeeded' || !s.preview ? (
        <RowCardsSkeleton count={2} />
      ) : !s.preview.locations.length ? (
        <EmptyState icon="calendar-outline" title="Nothing to preview yet" body="Add a location and its weekly hours to see what patients will see." />
      ) : (
        <View style={styles.list}>
          {s.preview.paused ? (
            <InlineNotice
              tone="warning"
              title="Bookings are paused"
              message="These are your free times, but patients see none of them until you turn bookings back on (Locations)."
            />
          ) : (
            <AppText variant="small" tone="muted">{`Your next ${PREVIEW_DAYS} days, exactly as patients see them.`}</AppText>
          )}
          {s.preview.locations.map(l => {
            const total = l.days.reduce((n, d) => n + d.slots.length, 0);
            return (
              <Card key={l.id}>
                <View style={styles.row}>
                  <IonIcon name={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
                  <View style={styles.grow}>
                    <AppText variant="title">{l.name}</AppText>
                    <AppText variant="small" tone="muted">{`${total} open ${total === 1 ? 'time' : 'times'}`}</AppText>
                  </View>
                </View>
                {!total ? <InlineNotice tone="warning" message="Patients can't book here: no open times in these days. Check its weekly hours and time off." embedded /> : null}
                {l.days.map((d, i) => (
                  <View key={d.date}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.previewDay}>
                      <AppText variant="bodyStrong">{formatDayChip(d.date).long}</AppText>
                      <AppText variant="small" tone={d.slots.length ? 'ink' : 'muted'}>
                        {d.slots.length
                          ? `${d.slots.length} · ${formatSlot(d.slots[0], l.timezone)} – ${formatSlot(d.slots[d.slots.length - 1], l.timezone)}`
                          : 'No times'}
                      </AppText>
                    </View>
                  </View>
                ))}
              </Card>
            );
          })}
        </View>
      )}

      <Sheet
        visible={copyFrom !== null}
        onClose={() => setCopyFrom(null)}
        title={`Copy ${copyFrom ? WEEKDAYS.find(w => w.day === copyFrom)?.long : ''} to`}
        subtitle="The days you tick get the same hours."
        footer={
          <Button
            label={copyTargets.length ? `Copy to ${copyTargets.length} ${copyTargets.length === 1 ? 'day' : 'days'}` : 'Choose the days'}
            disabled={!copyTargets.length}
            onPress={() => {
              if (copyFrom) dispatch(copyDayTo({ from: copyFrom, to: copyTargets }));
              setCopyFrom(null);
            }}
            fullWidth
          />
        }>
        {WEEKDAYS.filter(w => w.day !== copyFrom).map(w => (
          <Checkbox
            key={w.day}
            checked={copyTargets.includes(w.day)}
            onToggle={on => setCopyTargets(t => (on ? [...t, w.day] : t.filter(x => x !== w.day)))}
            label={w.long}
            accessibilityLabel={`Copy to ${w.long}`}
          />
        ))}
        <TextAction label="Every other day" onPress={() => setCopyTargets(WEEKDAYS.filter(w => w.day !== copyFrom).map(w => w.day))} />
      </Sheet>

      <Sheet
        visible={s.sheet.open}
        onClose={() => dispatch(closeLocationSheet())}
        title={s.sheet.id ? `Edit ${form.kind === 'video' ? 'video consultations' : 'clinic'}` : form.kind === 'video' ? 'Offer video consultations' : 'Add a clinic'}
        footer={
          <View style={styles.footer}>
            {sheetError && !s.prepayRefused ? <InlineNotice message={sheetError} /> : null}
            <Button label="Save location" onPress={() => void saveLocation()} loading={s.busy === 'location'} fullWidth />
          </View>
        }>
        {s.prepayRefused ? (
          <InlineNotice
            tone="warning"
            title="Saved, without payment before the call"
            message="Asking patients to pay first needs an active payment account."
            action={{ label: 'Add a payment account', onPress: openPaymentAccounts }}
          />
        ) : null}
        {!s.sheet.id ? (
          <View style={styles.chips}>
            <ChoiceChip
              label="Clinic"
              icon="business-outline"
              selected={form.kind === 'clinic'}
              onPress={() => dispatch(editLocation({ kind: 'clinic', name: form.kind === 'video' ? '' : form.name, requiresPrepay: false }))}
            />
            {!hasVideo ? (
              <ChoiceChip
                label="Video"
                icon="videocam-outline"
                selected={form.kind === 'video'}
                onPress={() => dispatch(editLocation({ kind: 'video', name: form.name || 'Video consultation' }))}
              />
            ) : null}
          </View>
        ) : null}
        {!s.sheet.id && hasVideo && form.kind === 'clinic' ? (
          <AppText variant="caption" tone="muted">
            You already offer video consultations. Edit them from your locations.
          </AppText>
        ) : null}
        <TextField
          label={form.kind === 'video' ? 'Name' : 'Clinic or hospital'}
          value={form.name}
          onChangeText={t => dispatch(editLocation({ name: t }))}
          error={showLoc('name')}
          maxLength={LOCATION_LIMITS.name}
          placeholder={form.kind === 'video' ? 'Video consultation' : 'Ayesha Hospital'}
        />
        {form.kind === 'clinic' ? (
          <>
            <TextField
              label="Street address"
              value={form.address ?? ''}
              onChangeText={t => dispatch(editLocation({ address: t || null }))}
              error={showLoc('address')}
              maxLength={LOCATION_LIMITS.address}
              multiline
              placeholder="42-B Main Boulevard"
              helper="Building and street, so patients can find the clinic."
            />
            <TextField
              label="Area"
              value={form.area}
              onChangeText={t => dispatch(editLocation({ area: t }))}
              error={showLoc('area')}
              maxLength={LOCATION_LIMITS.area}
              placeholder="Gulberg III"
            />
            <TextField
              label="City"
              value={form.city}
              onChangeText={t => dispatch(editLocation({ city: t }))}
              error={showLoc('city')}
              maxLength={LOCATION_LIMITS.city}
              placeholder="Lahore"
            />
            <TextField
              label="Clinic phone (optional)"
              mode="phone"
              value={(form.phone ?? '').replace(/^\+92/, '')}
              onChangeText={v => dispatch(editLocation({ phone: v ? `+92${v.replace(/\D/g, '')}` : null }))}
              error={showLoc('phone')}
            />
            {s.sheet.pinning ? (
              <>
                <AppText variant="label">Move the map so the pin sits on the clinic</AppText>
                <FoodMap
                  pins={[]}
                  height={size.trackingMap}
                  picker={{ initial: pinStart, onCenterChange: p => dispatch(editLocation({ lat: p.lat, lng: p.lng })) }}
                  accessibilityLabel="Map: move it so the pin marks your clinic"
                />
                <TextAction label="Done" icon="checkmark" onPress={() => dispatch(setPinning(false))} />
              </>
            ) : (
              <View style={styles.links}>
                <TextAction
                  label={form.lat !== null ? 'Move the map pin' : 'Pin it on the map (optional)'}
                  icon="location-outline"
                  onPress={() => dispatch(setPinning(true))}
                />
                {form.lat !== null ? <TextAction label="Remove pin" tone="muted" onPress={() => dispatch(editLocation({ lat: null, lng: null }))} /> : null}
              </View>
            )}
          </>
        ) : (
          <>
            <ToggleRow
              label="Payment before the consultation"
              helper={
                s.hasPaymentAccount
                  ? 'Patients transfer the fee to your payment account first.'
                  : 'Add a payment account first, so patients know where to send the fee.'
              }
              value={form.requiresPrepay}
              disabled={!s.hasPaymentAccount && !form.requiresPrepay}
              onChange={v => dispatch(editLocation({ requiresPrepay: v }))}
            />
            {!s.hasPaymentAccount ? <TextAction label="Add a payment account" icon="card-outline" onPress={openPaymentAccounts} /> : null}
          </>
        )}
        <TextField
          label="Fee (Rs)"
          value={form.fee === null ? '' : String(form.fee)}
          onChangeText={t => {
            const digits = t.replace(/\D/g, '');
            dispatch(editLocation({ fee: digits ? Number(digits) : null }));
          }}
          keyboardType="number-pad"
          error={showLoc('fee')}
          placeholder="1500"
        />
        <AppText variant="label">Slot length</AppText>
        <View style={styles.chips}>
          {SLOT_LENGTHS.map(m => (
            <ChoiceChip key={m} label={`${m} min`} selected={form.slotMinutes === m} onPress={() => dispatch(editLocation({ slotMinutes: m }))} />
          ))}
        </View>
        {has('buffer') ? (
          <>
            <AppText variant="label">Break after each patient</AppText>
            <View style={styles.chips}>
              {BUFFER_CHOICES.map(m => (
                <ChoiceChip key={m} label={m ? `${m} min` : 'None'} selected={form.bufferMinutes === m} onPress={() => dispatch(editLocation({ bufferMinutes: m }))} />
              ))}
            </View>
          </>
        ) : null}
        <TextField
          label="Instructions for patients (optional)"
          value={form.instructions ?? ''}
          onChangeText={t => dispatch(editLocation({ instructions: t || null }))}
          error={showLoc('instructions')}
          maxLength={LOCATION_LIMITS.instructions}
          multiline
          placeholder={form.kind === 'video' ? 'Keep your reports and medicines nearby for the call.' : 'First floor, next to the pharmacy.'}
        />
        {s.sheet.id ? (
          <DangerRow
            label="Remove this location"
            icon="trash-outline"
            disabled={s.busy === 'delete'}
            confirm={{
              title: 'Remove this location?',
              message: "Patients won't see it any more. A location with patients booked can't be removed: move or cancel those visits first.",
              action: 'Remove',
            }}
            onConfirm={() => s.sheet.id && void dispatch(deleteLocationAsync(s.sheet.id))}
          />
        ) : null}
      </Sheet>
    </ScreenShell>
  );
};

export default Availability;
