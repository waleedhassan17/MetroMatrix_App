// ═══════════════════════════════════════════════════════
// MetroMatrix — Book an appointment (a sheet over the doctor's profile)
// ═══════════════════════════════════════════════════════
// The third tap: what you're booking (doctor, where or video, when, fee),
// who it's for, why (optional), reports to share, how you'll pay — and
// Confirm. If someone took the time a moment ago, three other times are
// offered right here; picking one and confirming books it.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  ChoiceChip,
  IonIcon,
  InlineNotice,
  PatientPicker,
  Sheet,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { MAX_REASON, REASON_TAGS, paymentOptionsFor } from '../../models/health/bookingModel';
import { PAYMENT_METHOD_LABEL } from '../../models/health/appointmentStatusModel';
import { recordTypeLabel } from '../../models/health/recordModel';
import type { HealthBrowseParamList } from '../../models';
import { formatOn, formatSlot, formatWhen } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadFamilyAsync, selectFamily } from '../family-members-screen/familySlice';
import {
  bookingHandled,
  closeBooking,
  confirmBookingAsync,
  loadBookingRecordsAsync,
  pickAlternative,
  selectBooking,
  setBookingFor,
  setBookingReason,
  setPaymentMethod,
  toggleReasonTag,
  toggleRecord,
  toggleRecordsPicker,
} from './bookAppointmentSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    lineText: { flex: 1 },
    records: { gap: space.s4 },
  });

type Nav = NativeStackNavigationProp<HealthBrowseParamList>;

export const BookAppointmentSheet: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const navigation = useNavigation<Nav>();
  const b = useAppSelector(selectBooking);
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
      visible={b.open}
      onClose={() => dispatch(closeBooking())}
      title="Confirm your appointment"
      footer={<Button label="Confirm appointment" leftIcon="checkmark-circle-outline" onPress={() => void confirm()} loading={b.status === 'loading'} disabled={taken} fullWidth />}>
      <Card>
        <AppText variant="title">{b.doctorName}</AppText>
        <View style={styles.line}>
          <IonIcon name={loc.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="md" color={service.accentDeep} />
          <AppText variant="body" style={styles.lineText}>
            {loc.kind === 'video' ? 'Video consultation' : [loc.name, loc.area].filter(Boolean).join(', ')}
          </AppText>
        </View>
        <View style={styles.line}>
          <IonIcon name="calendar-outline" size="md" color={service.accentDeep} />
          <AppText variant="bodyStrong" style={styles.lineText}>
            {formatWhen(b.startAt, tz)}
          </AppText>
        </View>
        <View style={styles.line}>
          <IonIcon name="cash-outline" size="md" color={service.accentDeep} />
          <AppText variant="body" style={styles.lineText}>
            {`Fee ${formatPKR(loc.fee)}`}
          </AppText>
        </View>
      </Card>

      {taken ? (
        <View style={styles.group}>
          <InlineNotice tone="warning" title="Someone booked this time a moment ago" message={b.alternatives.length ? 'Choose one of the next free times:' : 'Choose another time on the profile.'} />
          <View style={styles.chips}>
            {b.alternatives.map(a => (
              <ChoiceChip key={a} label={formatWhen(a, tz)} icon="time-outline" onPress={() => dispatch(pickAlternative(a))} accessibilityHint="Book this time instead" />
            ))}
          </View>
        </View>
      ) : b.error.message ? (
        <InlineNotice message={b.error.message} />
      ) : null}

      <View style={styles.group}>
        <AppText variant="label">Who is it for</AppText>
        <PatientPicker
          family={family.members}
          selected={b.familyMemberId}
          onSelect={id => dispatch(setBookingFor(id))}
          onAdd={() => leave(() => navigation.navigate('FamilyMemberForm'))}
        />
      </View>

      <View style={styles.group}>
        <AppText variant="label">Reason for the visit (optional)</AppText>
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
      </View>

      <View style={styles.group}>
        <TextAction
          label={b.recordIds.length ? `Reports to share (${b.recordIds.length})` : 'Attach reports'}
          icon={b.recordsOpen ? 'chevron-up' : 'attach-outline'}
          onPress={() => dispatch(toggleRecordsPicker())}
        />
        {b.recordsOpen ? (
          <View style={styles.records}>
            {b.records.length ? (
              b.records.map(r => (
                <Checkbox
                  key={r.id}
                  checked={b.recordIds.includes(r.id)}
                  onToggle={() => dispatch(toggleRecord(r.id))}
                  label={
                    <View>
                      <AppText variant="body">{r.title}</AppText>
                      <AppText variant="caption" tone="muted">{`${recordTypeLabel(r.type)} · ${r.memberName} · ${formatOn(`${r.recordedOn}T12:00:00Z`)}`}</AppText>
                    </View>
                  }
                  accessibilityLabel={`Share ${r.title}`}
                />
              ))
            ) : (
              <AppText variant="small" tone="muted">
                No records yet.
              </AppText>
            )}
            <TextAction label="Upload a new report" icon="cloud-upload-outline" onPress={() => leave(() => navigation.navigate('RecordUpload', undefined))} />
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        <AppText variant="label">Payment</AppText>
        {options.length > 1 ? (
          <View style={styles.chips}>
            {options.map(m => (
              <ChoiceChip key={m} label={m === 'pay_at_visit' ? 'Pay at the consultation' : 'Transfer before it'} selected={b.paymentMethod === m} onPress={() => dispatch(setPaymentMethod(m))} />
            ))}
          </View>
        ) : (
          <AppText variant="bodyStrong">{loc.kind === 'clinic' ? 'Pay at the clinic' : PAYMENT_METHOD_LABEL[options[0]]}</AppText>
        )}
        <AppText variant="small" tone="muted">
          {b.paymentMethod === 'transfer'
            ? `${loc.requiresPrepay ? 'This doctor asks for payment before video consultations. ' : ''}You'll see the doctor's account next. Send ${formatPKR(loc.fee)} within 3 hours (and before ${formatSlot(b.startAt, tz)}) to keep this time.`
            : 'You pay the doctor directly. MetroMatrix never holds your money.'}
        </AppText>
      </View>
    </Sheet>
  );
};

export default BookAppointmentSheet;
