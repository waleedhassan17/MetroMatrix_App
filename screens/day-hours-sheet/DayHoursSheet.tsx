// ═══════════════════════════════════════════════════════
// MetroMatrix — Hours for one day (a sheet over the calendar, not a route)
// ═══════════════════════════════════════════════════════
// Different hours, or closed, at one location on one date. Save checks first:
// booked visits the new hours leave out are listed (they stay booked) and
// hours a clinic shares with the video consultation are named; the doctor
// then saves. A day with its own hours can go back to the usual ones.

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, IconButton, InlineNotice, Sheet, TextAction, TextField, TimeField } from '../../Custom-Components/index';
import { MAX_DAY_NOTE, validateDayHours } from '../../models/health/availabilityModel';
import { formatDayFull, formatWhen } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import {
  addDayRange,
  chooseDayHoursPlace,
  closeDayHours,
  removeDayHoursAsync,
  removeDayRange,
  saveDayHoursAsync,
  selectDayHours,
  setDayClosed,
  setDayNote,
  setDayRange,
  touchDayHours,
} from './dayHoursSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    scroll: { gap: space.s8 },
    range: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    grow: { flex: 1 },
  });

/** The app keeps the end of the day as 23:59; the clock picker calls it midnight (24:00). */
const toPicker = (hhmm: string) => (hhmm === '23:59' ? '24:00' : hhmm);
const fromPicker = (hhmm: string) => (hhmm === '24:00' ? '23:59' : hhmm);

export const DayHoursSheet: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectDayHours);
  const place = s.locations.find(l => l.id === s.locationId);
  const errors = validateDayHours(s.closed, s.ranges, place?.slotMinutes ?? 15);
  const show = (k: string) => (s.touched ? errors[k] : undefined);
  const input = s.date ? { date: s.date, closed: s.closed, ranges: s.ranges, note: s.note.trim() || null } : null;
  const flagged = !!s.check && (s.check.outsideHours.length > 0 || s.check.sharedWith.length > 0);

  // A clean check saves at once; one with something to say waits for the doctor.
  useEffect(() => {
    if (!s.check || flagged || !input || !s.locationId) return;
    void dispatch(saveDayHoursAsync({ locationId: s.locationId, input, dryRun: false }));
    // Only when a check comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.check]);

  const save = () => {
    dispatch(touchDayHours());
    if (!input || !s.locationId) return;
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    void dispatch(saveDayHoursAsync({ locationId: s.locationId, input, dryRun: !s.check }));
  };

  return (
    <Sheet
      visible={s.open}
      onClose={() => dispatch(closeDayHours())}
      title={s.date ? `Hours on ${formatDayFull(s.date)}` : 'Hours for the day'}
      subtitle="These replace your usual hours for this day only."
      footer={
        <View style={styles.group}>
          <Button
            label={flagged ? 'Save these hours' : s.closed ? 'Close this day' : 'Save hours'}
            leftIcon="checkmark-circle-outline"
            onPress={save}
            loading={s.status === 'loading'}
            fullWidth
          />
          {s.existing && s.locationId && s.date ? (
            <Button
              label="Back to my usual hours"
              variant="ghost"
              onPress={() => void dispatch(removeDayHoursAsync({ locationId: s.locationId!, date: s.date! }))}
              disabled={s.status === 'loading'}
              fullWidth
            />
          ) : null}
        </View>
      }>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.locations.length > 1 ? (
        <View style={styles.group}>
          <AppText variant="label">Where</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {s.locations.map(l => (
              <ChoiceChip key={l.id} label={l.name} selected={s.locationId === l.id} onPress={() => dispatch(chooseDayHoursPlace(l.id))} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.chips}>
        <ChoiceChip label="Different hours" icon="time-outline" selected={!s.closed} onPress={() => dispatch(setDayClosed(false))} />
        <ChoiceChip label="Closed" icon="close-circle-outline" selected={s.closed} onPress={() => dispatch(setDayClosed(true))} />
      </View>
      {s.closed ? (
        <AppText variant="small" tone="muted">
          {"Patients can't book this day here. Visits already booked stay, and you'll see them before saving."}
        </AppText>
      ) : (
        <View style={styles.group}>
          {s.ranges.map((r, i) => (
            <View key={i} style={styles.group}>
              <View style={styles.range}>
                <View style={styles.grow}>
                  <TimeField label="From" value={r.from} onChange={v => dispatch(setDayRange({ index: i, field: 'from', value: v }))} error={show(`range.${i}`)} />
                </View>
                <View style={styles.grow}>
                  <TimeField label="To" value={toPicker(r.to)} onChange={v => dispatch(setDayRange({ index: i, field: 'to', value: fromPicker(v) }))} allowMidnight />
                </View>
                {s.ranges.length > 1 ? (
                  <IconButton icon="close" tone="muted" onPress={() => dispatch(removeDayRange(i))} accessibilityLabel={`Remove hours ${i + 1}`} />
                ) : null}
              </View>
            </View>
          ))}
          {show('ranges') ? (
            <AppText variant="small" tone="danger">
              {show('ranges')}
            </AppText>
          ) : null}
          <TextAction label="Add more hours" icon="add" onPress={() => dispatch(addDayRange())} />
        </View>
      )}
      <TextField
        label="Note (only you see it)"
        value={s.note}
        onChangeText={t => dispatch(setDayNote(t))}
        placeholder="Late clinic before Eid"
        maxLength={MAX_DAY_NOTE}
      />
      {s.check?.outsideHours.length ? (
        <InlineNotice
          tone="warning"
          title={`${s.check.outsideHours.length} booked ${s.check.outsideHours.length === 1 ? 'visit falls' : 'visits fall'} outside`}
          message={`${s.check.outsideHours.map(v => `${v.patientName}, ${formatWhen(v.startAt, v.timezone)}`).join('; ')}. They stay booked: move or cancel them from the calendar if you need to.`}
        />
      ) : null}
      {s.check?.sharedWith.length ? (
        <InlineNotice
          tone="info"
          title="Shared hours"
          message={`${s.check.sharedWith[0].locationName} is open then too. Booking either closes the other.`}
        />
      ) : null}
    </Sheet>
  );
};

export default DayHoursSheet;
