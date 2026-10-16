// ═══════════════════════════════════════════════════════
// MetroMatrix — Calendar
// ═══════════════════════════════════════════════════════
// Day: an hour grid with each visit as a block in its location's shade of
// the accent (no new colours). Week: the week as an agenda. Tap a visit to
// open it; hold an empty hour (or use "Take this day off") to block the day.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { mix, ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Divider, IconButton, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, TextAction } from '@custom/index';
import { APPOINTMENT_STATUS } from '@models/health/appointmentStatusModel';
import type { CalendarItem, DoctorPartnerStackParamList } from '@/types';
import { PKT, addDays, dateInZone, formatDayChip, formatDayShort, formatSlot, hourOfDay, todayInZone, weekStart } from '@utils/healthTime';
import { loadCalendarAsync, selectDoctorCalendar, setCalendarMode, type CalendarMode } from './doctorCalendarSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorTabs'>;

const FIRST_HOUR = 7;
const LAST_HOUR = 24;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navLabel: { flex: 1, alignItems: 'center' },
    grid: { position: 'relative' },
    hour: { flexDirection: 'row', height: size.calendarHour, borderTopWidth: size.hairline, borderTopColor: colors.lineSoft },
    hourLabel: { width: size.calendarGutter, paddingTop: space.s4 },
    block: { position: 'absolute', right: 0, borderRadius: radius.sm, paddingHorizontal: space.s8, paddingVertical: space.s4, overflow: 'hidden', borderLeftWidth: size.focusBorder * 2 },
    off: { gap: space.s4, padding: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    day: { gap: space.s8, paddingVertical: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touch },
    dot: { width: size.doseDot, height: size.doseDot, borderRadius: radius.pill },
    grow: { flex: 1, gap: space.s0 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

const DoctorCalendarScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorCalendarContent {...props} />
  </ServiceScope>
);

const DoctorCalendarContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, size } = useTheme();
  const s = useAppSelector(selectDoctorCalendar);
  const today = todayInZone(PKT);
  const date = s.date ?? today;
  const nav = navigation as unknown as { navigate: (n: string, p?: object) => void };

  const load = useCallback(
    (d: string, mode: CalendarMode) => {
      const from = mode === 'day' ? d : weekStart(d);
      void dispatch(loadCalendarAsync({ date: d, from, to: mode === 'day' ? d : addDays(from, 6) }));
    },
    [dispatch],
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
  const shades = [service.accentSoft, mix(service.accent, colors.surface, 0.62), mix(service.accentDeep, colors.surface, 0.82), mix(service.accent, colors.surface, 0.9)];
  const edges = [service.accent, service.accentDeep, service.accent, service.accentDeep];
  const shadeOf = (locationId: string) => {
    const i = Math.max(0, r?.locations.findIndex(l => l.id === locationId) ?? 0);
    return { bg: shades[i % shades.length], edge: edges[i % edges.length] };
  };
  const open = (a: CalendarItem) => nav.navigate('DoctorAppointment', { id: a.id });
  const offToday = r?.timeOff.filter(t => t.from <= date && date <= t.to) ?? [];
  const step = s.mode === 'day' ? 1 : 7;
  const label = s.mode === 'day' ? formatDayChip(date).long : `${formatDayShort(weekStart(date))} – ${formatDayShort(addDays(weekStart(date), 6))}`;

  return (
    <ScreenShell title="Calendar" subtitle={label} refreshing={s.status === 'loading' && !!r} onRefresh={() => load(date, s.mode)}>
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
      <View style={styles.nav}>
        <IconButton icon="chevron-back" onPress={() => load(addDays(date, -step), s.mode)} accessibilityLabel={s.mode === 'day' ? 'Previous day' : 'Previous week'} />
        <View style={styles.navLabel}>
          <AppText variant="title">{label}</AppText>
          {date !== today ? <TextAction label="Today" onPress={() => load(today, s.mode)} /> : null}
        </View>
        <IconButton icon="chevron-forward" onPress={() => load(addDays(date, step), s.mode)} accessibilityLabel={s.mode === 'day' ? 'Next day' : 'Next week'} />
      </View>
      {r && r.locations.length > 1 ? (
        <View style={styles.legend}>
          {r.locations.map(l => (
            <View key={l.id} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: shadeOf(l.id).edge }]} />
              <AppText variant="caption" tone="muted">
                {l.name}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      {!r ? (
        <SkeletonLines lines={10} />
      ) : s.mode === 'day' ? (
        <>
          {offToday.map(t => (
            <View key={t.id} style={styles.off}>
              <AppText variant="bodyStrong">{`Time off${t.locationName ? ` at ${t.locationName}` : ''}`}</AppText>
              {t.reason ? <AppText variant="small" tone="muted">{t.reason}</AppText> : null}
            </View>
          ))}
          {!offToday.length && date >= today ? <TextAction label="Take this day off" icon="close-circle-outline" onPress={() => nav.navigate('TimeOff', { date })} /> : null}
          <View style={styles.grid}>
            {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i).map(h => (
              <Pressable
                key={h}
                style={styles.hour}
                onLongPress={() => date >= today && nav.navigate('TimeOff', { date })}
                accessibilityHint="Hold to take this day off">
                <View style={styles.hourLabel}>
                  <AppText variant="caption" tone="muted">
                    {`${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`}
                  </AppText>
                </View>
              </Pressable>
            ))}
            {r.appointments.map(a => {
              const start = hourOfDay(a.startAt, a.timezone);
              const end = Math.max(start + 0.4, hourOfDay(a.endAt, a.timezone) || start + 0.25);
              if (start < FIRST_HOUR || start >= LAST_HOUR) return null;
              const shade = shadeOf(a.locationId);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => open(a)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatSlot(a.startAt, a.timezone)}, ${a.patientName}, ${a.locationName}, ${APPOINTMENT_STATUS[a.status].label}`}
                  style={[
                    styles.block,
                    {
                      top: (start - FIRST_HOUR) * size.calendarHour,
                      height: Math.max(size.touch * 0.6, (end - start) * size.calendarHour - 2),
                      left: size.calendarGutter,
                      backgroundColor: shade.bg,
                      borderLeftColor: shade.edge,
                      opacity: a.status === 'no_show' ? 0.55 : 1,
                    },
                  ]}>
                  <AppText variant="caption" numberOfLines={1}>{`${formatSlot(a.startAt, a.timezone)} · ${a.patientName}`}</AppText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)).map((d, i) => {
          const list = r.appointments.filter(a => dateInZone(a.startAt, a.timezone) === d);
          const off = r.timeOff.filter(t => t.from <= d && d <= t.to);
          return (
            <View key={d}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.day}>
                <AppText variant="title" tone={d === today ? 'accentDeep' : 'ink'}>
                  {formatDayChip(d).long}
                </AppText>
                {off.length ? <AppText variant="small" tone="muted">{`Time off${off[0].reason ? ` · ${off[0].reason}` : ''}`}</AppText> : null}
                {list.length ? (
                  list.map(a => (
                    <Pressable key={a.id} onPress={() => open(a)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${formatSlot(a.startAt, a.timezone)}, ${a.patientName}, ${a.locationName}`}>
                      <View style={[styles.dot, { backgroundColor: shadeOf(a.locationId).edge }]} />
                      <AppText variant="bodyStrong">{formatSlot(a.startAt, a.timezone)}</AppText>
                      <View style={styles.grow}>
                        <AppText variant="body">{a.patientName}</AppText>
                        <AppText variant="caption" tone="muted">{`${a.locationName} · ${APPOINTMENT_STATUS[a.status].label}`}</AppText>
                      </View>
                    </Pressable>
                  ))
                ) : !off.length ? (
                  <AppText variant="small" tone="muted">
                    No appointments
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
};

export default DoctorCalendarScreen;
