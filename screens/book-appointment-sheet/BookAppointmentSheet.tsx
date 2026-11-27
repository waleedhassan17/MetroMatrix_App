// ═══════════════════════════════════════════════════════
// MetroMatrix — Book an appointment (a sheet over the doctor's profile)
// ═══════════════════════════════════════════════════════
// The third tap: what you're booking (doctor, where or video, when, fee),
// who it's for, why (optional), reports to share, how you'll pay — and
// Confirm. If someone took the time a moment ago, three other times are
// offered right here; picking one and confirming books it.

import { newUuid } from '../../utils/ids/ids';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useNow } from '../../hooks/useNow';
import { useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Checkbox,
  ChoiceChip,
  InlineNotice,
  MoneyRows,
  PatientPicker,
  SectionCard,
  Sheet,
  TextField,
} from '../../Custom-Components/index';
import { selectUser } from '../../store/authSlice';
import { MAX_REASON, REASON_TAGS, paymentOptionsFor, prepayDeadline } from '../../models/health/bookingModel';
import { PAYMENT_METHOD_LABEL } from '../../models/health/appointmentStatusModel';
import { recordTypeLabel } from '../../models/health/recordModel';
import type { HealthBrowseParamList } from '../../models';
import { formatOn, formatWhen } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadFamilyAsync, selectFamily } from '../family-members-screen/familySlice';
import {
  bookingHandled,
  closeBooking,
  confirmBookingAsync,
  loadBookingRecordsAsync,
  MAX_BOOKING_RECORDS,
  pickAlternative,
  selectBooking,
  setBookingFor,
  setBookingReason,
  setPaymentMethod,
  toggleReasonTag,
  toggleRecord,
} from './bookAppointmentSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    facts: { gap: space.s4 },
  });

type Nav = NativeStackNavigationProp<HealthBrowseParamList>;

/**
 * `viewKey`: the profile showing it. Two profiles stacked (a similar doctor
 * opened from the first) each hold a sheet; only the one that opened it shows.
 */
export const BookAppointmentSheet: React.FC<{ viewKey: string }> = ({ viewKey }) => {
  const now = useNow();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<Nav>();
  const b = useAppSelector(selectBooking);
  const me = useAppSelector(selectUser);
  // Only the reports of the person the visit is for.
  const mine = b.records.filter(r => r.memberId === b.familyMemberId);
  const family = useAppSelector(selectFamily);
  const loc = b.location;

  useEffect(() => {
    if (!b.open) return;
    if (family.status === 'idle') void dispatch(loadFamilyAsync());
    void dispatch(loadBookingRecordsAsync());
  }, [b.open, family.status, dispatch]);

  // Booked: on to the confirmation (once).
  useEffect(() => {
    if (!b.bookedCode) return;
    haptics.success();
    navigation.navigate('BookingConfirmed', { code: b.bookedCode });
    dispatch(bookingHandled());
  }, [b.bookedCode, navigation, dispatch]);

  if (!loc || !b.startAt || !b.doctorId) return null;
  const tz = loc.timezone;
  const options = paymentOptionsFor(loc);
  const taken = b.error.code === 'SLOT_TAKEN';

  const confirm = async () => {
    const startAt = b.startAt!;
    const r = await dispatch(
      confirmBookingAsync({
        idempotencyKey: b.idempotencyKey,
        input: {
          doctorId: b.doctorId!,
          locationId: loc.id,
          startAt,
          familyMemberId: b.familyMemberId,
          reasonTags: b.reasonTags,
          reason: b.reason.trim() || null,
          recordIds: b.recordIds,
          paymentMethod: b.paymentMethod,
        },
      }),
    );
    if (confirmBookingAsync.rejected.match(r)) haptics.warning();
  };

  const leave = (go: () => void) => {
    dispatch(closeBooking());
    go();
  };

  return (
    <Sheet
      visible={b.open && b.viewKey === viewKey}
      onClose={() => dispatch(closeBooking())}
      title="Confirm your appointment"
      footer={<Button label="Confirm appointment" leftIcon="checkmark-circle-outline" onPress={() => void confirm()} loading={b.status === 'loading'} disabled={taken} fullWidth />}>
      <SectionCard
        title="Visit"
        icon="calendar-outline"
        action={{ label: 'Change', onPress: () => dispatch(closeBooking()) }}>
        <View style={styles.facts}>
          <AppText variant="title" numberOfLines={1}>
            {b.doctorName}
          </AppText>
          <AppText variant="bodyStrong">{formatWhen(b.startAt, tz)}</AppText>
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {loc.kind === 'video' ? 'Video consultation' : [loc.name, loc.area].filter(Boolean).join(', ')}
          </AppText>
        </View>
      </SectionCard>

      {taken ? (
        <View style={styles.group}>
          <InlineNotice tone="warning" title="Someone booked this time a moment ago" message={b.alternatives.length ? 'Choose one of the next free times:' : 'Choose another time on the profile.'} />
          <View style={styles.chips}>
            {b.alternatives.map(a => (
              <ChoiceChip key={a} label={formatWhen(a, tz)} icon="time-outline" onPress={() => dispatch(pickAlternative({ startAt: a, idempotencyKey: newUuid() }))} accessibilityHint="Book this time instead" />
            ))}
          </View>
        </View>
      ) : b.error.message ? (
        <InlineNotice message={b.error.message} />
      ) : null}

      <SectionCard title="Who it's for" icon="people-outline">
        <PatientPicker
          family={family.members}
          selected={b.familyMemberId}
          meName={me?.name}
          onSelect={id => dispatch(setBookingFor(id))}
          onAdd={() => leave(() => navigation.navigate('FamilyMemberForm'))}
        />
      </SectionCard>

      <SectionCard title="Reason" subtitle="Optional: it helps the doctor prepare" icon="chatbubble-ellipses-outline">
        <View style={styles.chips}>
          {REASON_TAGS.map(t => (
            <ChoiceChip key={t.key} label={t.label} selected={b.reasonTags.includes(t.key)} onPress={() => dispatch(toggleReasonTag(t.key))} />
          ))}
        </View>
        <TextField
          label="Anything the doctor should know"
          value={b.reason}
          onChangeText={t => dispatch(setBookingReason(t))}
          multiline
          maxLength={MAX_REASON}
          placeholder="Fever and sore throat for three days"
        />
      </SectionCard>

      <SectionCard
        title="Reports"
        subtitle={mine.length ? `${b.recordIds.length} of ${MAX_BOOKING_RECORDS} at most, shared only with this doctor` : 'Share earlier reports with this doctor'}
        icon="document-attach-outline"
        action={{ label: 'Upload', onPress: () => leave(() => navigation.navigate('RecordUpload', undefined)) }}>
        {mine.length ? (
          mine.map(r => (
            <Checkbox
              key={r.id}
              checked={b.recordIds.includes(r.id)}
              onToggle={() => dispatch(toggleRecord(r.id))}
              label={
                <View>
                  <AppText variant="body" numberOfLines={1}>
                    {r.title}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>{`${recordTypeLabel(r.type)} · ${formatOn(`${r.recordedOn}T12:00:00Z`)}`}</AppText>
                </View>
              }
              accessibilityLabel={`Share ${r.title}`}
            />
          ))
        ) : (
          <AppText variant="small" tone="muted">
            {b.familyMemberId ? 'No reports saved for them yet.' : 'No reports saved for you yet.'}
          </AppText>
        )}
      </SectionCard>

      <SectionCard title="Payment" icon="wallet-outline">
        {options.length > 1 ? (
          <View style={styles.chips}>
            {options.map(m => (
              <ChoiceChip key={m} label={m === 'pay_at_visit' ? 'Pay at the consultation' : 'Transfer before it'} selected={b.paymentMethod === m} onPress={() => dispatch(setPaymentMethod(m))} />
            ))}
          </View>
        ) : (
          <AppText variant="bodyStrong">{loc.kind === 'clinic' ? 'Pay at the clinic' : PAYMENT_METHOD_LABEL[options[0]]}</AppText>
        )}
        <MoneyRows
          rows={[
            { label: 'Consultation fee', value: loc.fee },
            { label: 'MetroMatrix fee · no commission', value: 0, kind: 'free' },
            { label: 'You pay the doctor', value: loc.fee, kind: 'total' },
          ]}
        />
        <AppText variant="small" tone="muted">
          {b.paymentMethod === 'transfer'
            ? loc.requiresPrepay
              ? `This doctor asks for payment before video consultations. You'll see their account next: send ${formatPKR(loc.fee)} by ${formatWhen(prepayDeadline(b.startAt, now), tz)}, or this time is released for other patients.`
              : `You'll see the doctor's account next. Send ${formatPKR(loc.fee)} before your consultation. You pay the doctor directly.`
            : 'You pay the doctor directly. MetroMatrix never holds your money.'}
        </AppText>
      </SectionCard>
    </Sheet>
  );
};

export default BookAppointmentSheet;
