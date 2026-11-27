// ═══════════════════════════════════════════════════════
// MetroMatrix — Calendar
// ═══════════════════════════════════════════════════════
// A day or a week as an agenda: each visit a row in a white card, in time
// order, grouped by part of the day, with its location's dot and ONE status
// pill. (An hour grid stacked back-to-back 15-minute visits on top of each
// other and hid anything before 7 AM: the 2026-11-26 QA.) Tap a visit to open
// it; "Take this day off" blocks a day; "Change hours for this day" gives it
// its own hours (or closes it) at one location, where the server can.

import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { mix, ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  IconButton,
  InlineNotice,
  RowCardsSkeleton,
  ScreenShell,
  SegmentTabs,
  StatusPill,
  TextAction,
} from '../../Custom-Components/index';
import { APPOINTMENT_STATUS } from '../../models/health/appointmentStatusModel';
import { DAY_PART_LABEL, byDayPart } from '../../models/health/calendarModel';
import type { CalendarItem, CalendarRange, DoctorPartnerStackParamList } from '../../models';
import { PKT, addDays, dateInZone, formatDayChip, formatDayShort, formatSlot, todayInZone, weekStart } from '../../utils/health-time/healthTime';
import { loadCalendarAsync, selectDoctorCalendar, setCalendarMode, type CalendarMode } from './doctorCalendarSlice';
import { selectHasDoctorFeature } from '../../store/doctorFeaturesSlice';
import { DayHoursSheet } from '../day-hours-sheet/DayHoursSheet';
import { loadDayHoursAsync, openDayHours, selectDayHours } from '../day-hours-sheet/dayHoursSlice';
import type { DayHours } from '../../models';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorTabs'>;

const makeStyles = ({ space, radius, size }: Theme) =>
  StyleSheet.create({
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navLabel: { flex: 1, alignItems: 'center', gap: space.s0 },
    list: { gap: space.s16 },
    group: { gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touch, paddingVertical: space.s8 },
    time: { minWidth: size.calendarGutter },
    dot: { width: size.doseDot, height: size.doseDot, borderRadius: radius.pill },
    grow: { flex: 1, gap: space.s0 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });

/** "18:00" → "6:00 PM" (23:59, the end of the day, reads as midnight). */
const clock12 = (hm: string) => {
  const [h, m] = (hm === '23:59' ? '24:00' : hm).split(':').map(Number);
  const hh = h % 24;
  return `${hh % 12 || 12}:${String(m).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};

const DoctorCalendar: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorCalendarContent {...props} />
  </ServiceScope>
);

const DoctorCalendarContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const s = useAppSelector(selectDoctorCalendar);
  const today = todayInZone(PKT);
  const date = s.date ?? today;
  const nav = navigation as unknown as { navigate: (n: string, p?: object) => void };

  const load = useCallback((d: string, mode: CalendarMode) => void dispatch(loadCalendarAsync({ date: d, mode })), [dispatch]);
  const ownHours = useAppSelector(st => selectHasDoctorFeature(st, 'overrides'));
  const dayHours = useAppSelector(selectDayHours);
  const placeIds = (s.range?.locations ?? []).map(l => l.id).join(',');
  const first = s.mode === 'day' ? date : weekStart(date);
  const last = s.mode === 'day' ? date : addDays(weekStart(date), 6);

  // Each location's own hours for the dates showing.
  useEffect(() => {
    if (!ownHours || !placeIds) return;
    void dispatch(loadDayHoursAsync({ locationIds: placeIds.split(','), from: first, to: last }));
  }, [ownHours, placeIds, first, last, dispatch]);

  const ownOn = (d: string) =>
    (s.range?.locations ?? []).flatMap(l => {
      const own = (dayHours.byLocation[l.id] ?? []).find(x => x.date === d);
      return own ? [{ location: l, own }] : [];
    });
  const hoursText = (own: DayHours) =>
    own.closed ? 'Closed this day' : own.ranges.map(x => `${clock12(x.from)} – ${clock12(x.to)}`).join(', ');
  const changeHours = (d: string, locationId?: string) =>
    dispatch(
      openDayHours({
        date: d,
        locationId,
        locations: (s.range?.locations ?? []).map(l => ({ id: l.id, name: l.name, slotMinutes: 15 })),
      }),
    );

  useFocusEffect(
    useCallback(() => {
      load(s.date ?? today, s.mode);
      // Reload on focus with whatever is showing.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, s.mode]),
  );

  const r = s.range;
  // Each location gets its own shade of the accent (tints, never new hues).
  const dots = [service.accent, service.accentDeep, mix(service.accent, colors.surface, 0.45), mix(service.accentDeep, colors.surface, 0.45)];
  const dotOf = (locationId: string) => dots[Math.max(0, r?.locations.findIndex(l => l.id === locationId) ?? 0) % dots.length];
  const open = (a: CalendarItem) => nav.navigate('DoctorAppointment', { id: a.id });
  const step = s.mode === 'day' ? 1 : 7;
  const label =
    s.mode === 'day' ? formatDayChip(date).long : `${formatDayShort(weekStart(date))} – ${formatDayShort(addDays(weekStart(date), 6))}`;

  const visitRow = (a: CalendarItem, i: number) => {
    const status = APPOINTMENT_STATUS[a.status];
    return (
      <React.Fragment key={a.id}>
        {i > 0 ? <Divider /> : null}
        <Pressable
          onPress={() => open(a)}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`${formatSlot(a.startAt, a.timezone)}, ${a.patientName}, ${a.locationName}, ${status.label}`}>
          <AppText variant="bodyStrong" style={styles.time}>
            {formatSlot(a.startAt, a.timezone)}
          </AppText>
          <View style={[styles.dot, { backgroundColor: dotOf(a.locationId) }]} />
          <View style={styles.grow}>
            <AppText variant="body" numberOfLines={1}>
              {a.patientName}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {a.locationName}
            </AppText>
          </View>
          <StatusPill label={status.label} tone={status.tone} />
        </Pressable>
      </React.Fragment>
    );
  };

  const timeOffOn = (range: CalendarRange, d: string) => range.timeOff.filter(t => t.from <= d && d <= t.to);

  return (
    <ScreenShell
      title="Calendar"
      subtitle={s.mode === 'day' ? 'Your day' : 'Your week'}
      headerContent={
        <SegmentTabs
          options={[
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
          ]}
          value={s.mode}
          onChange={m => {
            dispatch(setCalendarMode(m));
            load(date, m);
          }}
          accessibilityLabel="Calendar view"
        />
      }
      onRefresh={() => load(date, s.mode)}
      refreshing={false}>
      <View style={styles.nav}>
        <IconButton
          icon="chevron-back"
          onPress={() => load(addDays(date, -step), s.mode)}
          accessibilityLabel={s.mode === 'day' ? 'Previous day' : 'Previous week'}
        />
        <View style={styles.navLabel}>
          <AppText variant="title" align="center">
            {label}
          </AppText>
          {date !== today ? <TextAction label={s.mode === 'day' ? 'Back to today' : 'This week'} onPress={() => load(today, s.mode)} /> : null}
        </View>
        <IconButton
          icon="chevron-forward"
          onPress={() => load(addDays(date, step), s.mode)}
          accessibilityLabel={s.mode === 'day' ? 'Next day' : 'Next week'}
        />
      </View>

      {r && r.locations.length > 1 ? (
        <View style={styles.legend}>
          {r.locations.map(l => (
            <View key={l.id} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: dotOf(l.id) }]} />
              <AppText variant="caption" tone="muted">
                {l.name}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {s.error.message ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => load(date, s.mode) }} />
      ) : null}

      {!r ? (
        s.status === 'failed' ? null : <RowCardsSkeleton count={4} />
      ) : s.mode === 'day' ? (
        <View style={styles.list}>
          {ownHours
            ? ownOn(date).map(({ location, own }) => (
                <InlineNotice
                  key={location.id}
                  tone="info"
                  title={own.closed ? `Closed at ${location.name}` : `Different hours at ${location.name}`}
                  message={`${hoursText(own)}${own.note ? ` · ${own.note}` : ''}`}
                  action={{ label: 'Change', onPress: () => changeHours(date, location.id) }}
                />
              ))
            : null}
          {timeOffOn(r, date).map(t => (
            <InlineNotice
              key={t.id}
              tone="info"
              title={`Time off${t.hours ? ` ${clock12(t.hours.from)} – ${clock12(t.hours.to)}` : ''}${t.locationName ? ` at ${t.locationName}` : ''}`}
              message={t.reason ?? 'Patients can’t book you on this day.'}
            />
          ))}
          {r.appointments.length ? (
            byDayPart(r.appointments).map(g => (
              <View key={g.part} style={styles.group}>
                <AppText variant="bodyStrong" tone="muted">
                  {`${DAY_PART_LABEL[g.part]} · ${g.items.length}`}
                </AppText>
                <Card padded="horizontal">{g.items.map(visitRow)}</Card>
              </View>
            ))
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="No appointments"
              body={date < today ? 'Nothing was booked on this day.' : 'Bookings for this day appear here as patients make them.'}
              action={
                date >= today && !timeOffOn(r, date).length
                  ? { label: 'Take this day off', onPress: () => nav.navigate('TimeOff', { date }) }
                  : undefined
              }
            />
          )}
          {date >= today && ownHours && r.locations.length ? (
            <TextAction label="Change hours for this day" icon="time-outline" onPress={() => changeHours(date)} />
          ) : null}
          {r.appointments.length && date >= today && !timeOffOn(r, date).length ? (
            <TextAction label="Take this day off" icon="close-circle-outline" onPress={() => nav.navigate('TimeOff', { date })} />
          ) : null}
        </View>
      ) : (
        <View style={styles.list}>
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)).map(d => {
            const list = r.appointments
              .filter(a => dateInZone(a.startAt, a.timezone) === d)
              .sort((a, b) => a.startAt.localeCompare(b.startAt));
            const off = timeOffOn(r, d);
            return (
              <View key={d} style={styles.group}>
                <View style={styles.dayHead}>
                  <AppText variant="title" tone={d === today ? 'accentDeep' : 'ink'}>
                    {formatDayChip(d).long}
                  </AppText>
                  {list.length ? (
                    <AppText variant="caption" tone="muted">
                      {list.length === 1 ? '1 visit' : `${list.length} visits`}
                    </AppText>
                  ) : null}
                </View>
                {off.length ? (
                  <AppText variant="small" tone="muted">{`Time off${off[0].hours ? ` ${clock12(off[0].hours.from)} – ${clock12(off[0].hours.to)}` : ''}${off[0].reason ? ` · ${off[0].reason}` : ''}`}</AppText>
                ) : null}
                {ownHours
                  ? ownOn(d).map(({ location, own }) => (
                      <AppText key={location.id} variant="small" tone="muted">
                        {`${r.locations.length > 1 ? `${location.name}: ` : ''}${hoursText(own)}`}
                      </AppText>
                    ))
                  : null}
                {list.length ? (
                  <Card padded="horizontal">{list.map(visitRow)}</Card>
                ) : !off.length ? (
                  <AppText variant="small" tone="muted">
                    No appointments
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      <DayHoursSheet />
    </ScreenShell>
  );
};

export default DoctorCalendar;
