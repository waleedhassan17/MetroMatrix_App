// ═══════════════════════════════════════════════════════
// MetroMatrix — Pick one of your own times (move a visit, book a follow-up)
// ═══════════════════════════════════════════════════════
// A sheet over the doctor's appointment, not a route: where (moving keeps
// the kind of visit), the month's days with why an empty one is empty, the
// day's free times, and for a move the reason the patient is told. Opened
// with openVisitTime(); the screen opens the new visit once `done` is set.

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, DateStrip, InlineNotice, Sheet, SlotGrid, TextAction, TextField } from '../../Custom-Components/index';
import { addDays, formatWhen } from '../../utils/health-time/healthTime';
import {
  MAX_MOVE_REASON,
  VISIT_TIME_DAYS,
  closeVisitTime,
  loadVisitDaysAsync,
  loadVisitPlacesAsync,
  pickVisitTime,
  saveVisitTimeAsync,
  selectVisitTime,
  setMoveReason,
  showVisitDay,
  touchVisitTime,
  validateMoveReason,
} from './visitTimeSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    pager: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    group: { gap: space.s8 },
    chips: { gap: space.s8 },
  });

export const VisitTimeSheet: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVisitTime);
  const moving = s.mode === 'move';
  const reasonError = moving && s.touched ? validateMoveReason(s.reason) : undefined;

  // The month from the chosen start, at the chosen place.
  useEffect(() => {
    if (!s.open || !s.locationId) return;
    void dispatch(loadVisitPlacesAsync());
    void dispatch(loadVisitDaysAsync({ locationId: s.locationId, from: s.from }));
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.open]);

  const place = (locationId: string) => void dispatch(loadVisitDaysAsync({ locationId, from: s.from }));
  const later = () => {
    const last = s.days[s.days.length - 1]?.date;
    if (s.locationId && last) void dispatch(loadVisitDaysAsync({ locationId: s.locationId, from: addDays(last, 1), page: 'later' }));
  };
  const earlier = () => {
    if (s.locationId && s.pages.length) void dispatch(loadVisitDaysAsync({ locationId: s.locationId, from: s.pages[s.pages.length - 1], page: 'earlier' }));
  };

  // Someone took the time meanwhile: read the days again, so the grid shows what is really free.
  useEffect(() => {
    if (s.open && s.error.code === 'SLOT_TAKEN' && s.locationId) void dispatch(loadVisitDaysAsync({ locationId: s.locationId, from: s.from, keepError: true }));
    // Only when that error arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.error.code]);

  const save = () => {
    if (!s.appointmentId || !s.locationId || !s.selected) return;
    if (moving && validateMoveReason(s.reason)) {
      dispatch(touchVisitTime());
      return;
    }
    void dispatch(
      saveVisitTimeAsync({
        mode: s.mode,
        appointmentId: s.appointmentId,
        locationId: s.locationId,
        startAt: s.selected,
        reason: s.reason,
        sameLocation: s.locationId === s.originalLocationId,
      }),
    );
  };

  const tz = s.day?.timezone ?? 'Asia/Karachi';

  return (
    <Sheet
      visible={s.open}
      onClose={() => dispatch(closeVisitTime())}
      title={moving ? 'Move to another time' : 'Book a follow-up'}
      subtitle={moving ? 'The patient is told the new time and why.' : 'For the same patient; they are told.'}
      footer={
        <Button
          label={s.selected ? `${moving ? 'Move to' : 'Book'} ${formatWhen(s.selected, tz)}` : 'Choose a time'}
          leftIcon={moving ? 'swap-horizontal-outline' : 'calendar-outline'}
          onPress={save}
          disabled={!s.selected}
          loading={s.status === 'loading'}
          fullWidth
        />
      }>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.locations.length > 1 ? (
        <View style={styles.group}>
          <AppText variant="label">Where</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {s.locations.map(l => (
              <ChoiceChip
                key={l.id}
                label={l.name}
                icon={l.kind === 'video' ? 'videocam-outline' : 'business-outline'}
                selected={s.locationId === l.id}
                onPress={() => place(l.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.group}>
        <AppText variant="label">Day</AppText>
        <DateStrip days={s.days} selected={s.date} onSelect={d => dispatch(showVisitDay(d))} loading={s.loading} />
        <View style={styles.pager}>
          {s.pages.length ? <TextAction label="Earlier dates" icon="chevron-back" onPress={earlier} /> : null}
          {s.days.length >= VISIT_TIME_DAYS ? <TextAction label="Later dates" icon="chevron-forward" onPress={later} /> : null}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label">Time</AppText>
        <SlotGrid
          slots={s.day?.slots ?? []}
          timezone={tz}
          selected={s.selected}
          onSelect={t => dispatch(pickVisitTime(t))}
          loading={s.loading}
          nextAvailable={s.day?.nextAvailable ?? null}
          onNextAvailable={d => dispatch(showVisitDay(d))}
        />
      </View>
      {moving ? (
        <TextField
          label="Why (the patient is told)"
          value={s.reason}
          onChangeText={t => dispatch(setMoveReason(t))}
          placeholder="I have a surgery that morning."
          multiline
          maxLength={MAX_MOVE_REASON}
          error={reasonError}
        />
      ) : null}
    </Sheet>
  );
};

export default VisitTimeSheet;
