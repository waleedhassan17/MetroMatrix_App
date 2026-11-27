// ═══════════════════════════════════════════════════════
// MetroMatrix — Add a walk-in (a sheet over Today, not a route)
// ═══════════════════════════════════════════════════════
// The clinic (when there are several), their name, phone, gender and age if
// they give them, and why they came. Added, they join today's queue checked
// in, in the slot running now (or the next free one), or at a later free time
// today the doctor picks; Today opens the visit.

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, InlineNotice, Sheet, TextField } from '../../Custom-Components/index';
import { MAX_WALK_IN_NAME, MAX_WALK_IN_REASON, validateWalkIn } from '../../models/health/bookingModel';
import { haptics } from '../../utils/haptics/haptics';
import { formatSlot, PKT } from '../../utils/health-time/healthTime';
import { selectHasDoctorFeature } from '../../store/doctorFeaturesSlice';
import { addWalkInAsync, closeWalkIn, editWalkIn, loadWalkInTimesAsync, pickWalkInTime, selectWalkIn, touchWalkIn } from './walkInSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    scroll: { gap: space.s8 },
    pair: { flexDirection: 'row', gap: space.s12 },
    grow: { flex: 1 },
  });

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
] as const;

export const WalkInSheet: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectWalkIn);
  const ownSlots = useAppSelector(st => selectHasDoctorFeature(st, 'doctor_slots'));
  const f = s.form;
  // Today's free times at the chosen clinic, when the server can list them.
  useEffect(() => {
    if (s.open && ownSlots && f.locationId && s.times === null) void dispatch(loadWalkInTimesAsync(f.locationId));
  }, [s.open, ownSlots, f.locationId, s.times, dispatch]);
  const errors = validateWalkIn(f);
  const show = (k: keyof typeof f) => s.serverErrors[k] ?? (s.touched ? errors[k] : undefined);

  const add = () => {
    dispatch(touchWalkIn());
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    void dispatch(addWalkInAsync({ form: f, startAt: s.startAt }));
  };

  return (
    <Sheet
      visible={s.open}
      onClose={() => dispatch(closeWalkIn())}
      title="Add a walk-in"
      subtitle="They join today's queue, checked in, paying at the clinic."
      footer={<Button label="Add to the queue" leftIcon="person-add-outline" onPress={add} loading={s.status === 'loading'} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.clinics.length > 1 ? (
        <View style={styles.group}>
          <AppText variant="label">Clinic</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {s.clinics.map(c => (
              <ChoiceChip key={c.id} label={c.name} icon="business-outline" selected={f.locationId === c.id} onPress={() => dispatch(editWalkIn({ locationId: c.id }))} />
            ))}
          </ScrollView>
          {show('locationId') ? (
            <AppText variant="small" tone="danger">
              {show('locationId')}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {s.times && s.times.length > 1 ? (
        <View style={styles.group}>
          <AppText variant="label">When</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <ChoiceChip label="Next free" selected={!s.startAt} onPress={() => dispatch(pickWalkInTime(null))} />
            {s.times.slice(1).map(at => (
              <ChoiceChip key={at} label={formatSlot(at, PKT)} selected={s.startAt === at} onPress={() => dispatch(pickWalkInTime(at))} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <TextField
        label="Name"
        value={f.name}
        onChangeText={t => dispatch(editWalkIn({ name: t }))}
        placeholder="Bilal Ahmed"
        autoCapitalize="words"
        maxLength={MAX_WALK_IN_NAME}
        error={show('name')}
      />
      <TextField
        label="Phone (optional)"
        value={f.phone}
        onChangeText={t => dispatch(editWalkIn({ phone: t }))}
        placeholder="0312 3456789"
        keyboardType="phone-pad"
        helper="So the clinic can call them."
        maxLength={16}
        error={show('phone')}
      />
      <View style={styles.group}>
        <AppText variant="label">Gender (optional)</AppText>
        <View style={styles.chips}>
          {GENDERS.map(g => (
            <ChoiceChip
              key={g.key}
              label={g.label}
              selected={f.gender === g.key}
              onPress={() => dispatch(editWalkIn({ gender: f.gender === g.key ? null : g.key }))}
            />
          ))}
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.grow}>
          <TextField
            label="Age (optional)"
            value={f.age}
            onChangeText={t => dispatch(editWalkIn({ age: t.replace(/[^0-9]/g, '') }))}
            placeholder="41"
            keyboardType="number-pad"
            maxLength={3}
            error={show('age')}
          />
        </View>
      </View>
      <TextField
        label="Why they came (optional)"
        value={f.reason}
        onChangeText={t => dispatch(editWalkIn({ reason: t }))}
        placeholder="Fever since yesterday"
        multiline
        maxLength={MAX_WALK_IN_REASON}
        error={show('reason')}
      />
    </Sheet>
  );
};

export default WalkInSheet;
