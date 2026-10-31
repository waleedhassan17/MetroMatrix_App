// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: find an appointment
// ═══════════════════════════════════════════════════════
// Type the HC- code a patient or doctor quotes; see who, with whom, when and
// where, the status and payment, and everything that happened to it, in the
// practice's time. Read-only: the doctor and patient own the appointment.
// Shared records and notes stay private to them.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import {
  APPOINTMENT_PAYMENT_STATUS,
  APPOINTMENT_STATUS,
  KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  appointmentTimeline,
  eventLabel,
} from '../../models/health/appointmentStatusModel';
import { REASON_TAGS } from '../../models/health/bookingModel';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StatusPill, StatusTimeline, TextAction } from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import type { AdminHealthStackParamList } from '../../models';
import { formatTimeRange, formatWhen, formatLongDate } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { lookupAppointmentAsync, selectAppointmentLookup, setAppointmentLookupCode } from './appointmentLookupSlice';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'AppointmentLookup'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    pills: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    line: { gap: space.s0 },
    event: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12, paddingVertical: space.s8 },
    eventText: { flex: 1, gap: space.s0 },
  });

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
};

const AppointmentLookup: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'HealthOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAppointmentLookup);
  const a = s.result;

  useEffect(() => {
    const code = route.params?.code;
    if (code) {
      dispatch(setAppointmentLookupCode(code));
      void dispatch(lookupAppointmentAsync(code));
    }
  }, [route.params?.code, dispatch]);

  const find = () => s.code.length >= 4 && void dispatch(lookupAppointmentAsync(s.code));

  const patient = a
    ? [a.patient.name, a.patient.relation, a.patient.age !== null ? `${a.patient.age} years` : null].filter(Boolean).join(' · ')
    : '';
  const reasons = a ? [...a.reasonTags.map(t => REASON_TAGS.find(x => x.key === t)?.label ?? t), a.reason].filter(Boolean).join(' · ') : '';

  return (
    <ScreenShell
      title="Find an appointment"
      subtitle="Health · by the code on the booking"
      onBack={back}
      headerContent={
        <>
          <SearchField value={s.code} onChange={t => dispatch(setAppointmentLookupCode(t))} onSubmit={find} placeholder="Appointment code, e.g. HC-7K2M9P" />
          <Button label="Find" onPress={find} disabled={s.code.length < 4} loading={s.status === 'loading'} fullWidth />
        </>
      }>
      {s.status === 'idle' ? <EmptyState icon="search" title="Find any appointment" body="Type the HC- code from the patient's booking." /> : null}
      {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' ? <SkeletonLines lines={6} /> : null}
      {a ? (
        <>
          <Card>
            <AppText variant="title" selectable>
              {a.code}
            </AppText>
            <View style={styles.pills}>
              <StatusPill label={APPOINTMENT_STATUS[a.status].label} tone={APPOINTMENT_STATUS[a.status].tone} />
              <StatusPill label={APPOINTMENT_PAYMENT_STATUS[a.payment.status].label} tone={APPOINTMENT_PAYMENT_STATUS[a.payment.status].tone} />
            </View>
            <Line label="Patient" value={patient} />
            <Line label="Doctor" value={`${a.doctor.name} · ${a.doctor.specialty.name}`} />
            <Line label="When" value={`${formatLongDate(a.startAt, a.timezone)}, ${formatTimeRange(a.startAt, a.endAt, a.timezone)}`} />
            <Line
              label={KIND_LABEL[a.kind]}
              value={a.kind === 'video' ? 'Online' : [a.location.name, a.location.address ?? a.location.area, a.location.city].filter(Boolean).join(', ')}
            />
            <Line label="Fee" value={`${formatPKR(a.payment.amount || a.fee)} · ${PAYMENT_METHOD_LABEL[a.payment.method]}`} />
            {a.payment.proof ? <Line label="Transaction ID" value={a.payment.proof.transactionId} /> : null}
            {reasons ? <Line label="Reason for visit" value={reasons} /> : null}
            {a.cancelReason ? <Line label="Cancel reason" value={a.cancelReason} /> : null}
            {a.rescheduleCount ? <Line label="Rescheduled" value={a.rescheduleCount === 1 ? 'Once' : `${a.rescheduleCount} times`} /> : null}
            <Line label="Prescription" value={a.prescriptionId ? 'Written' : 'None'} />
            {a.doctorBusinessId ? (
              <TextAction
                label="Open the doctor's application"
                onPress={() =>
                  navigation.getParent()?.navigate('ApprovalsTab', { screen: 'BusinessReview', params: { id: a.doctorBusinessId, name: a.doctor.name }, initial: false })
                }
              />
            ) : null}
          </Card>
          <Card>
            <AppText variant="title">Status</AppText>
            <StatusTimeline steps={appointmentTimeline(a.status, a.kind, a.payment.method === 'transfer')} />
          </Card>
          {a.timeline.length ? (
            <Card>
              <AppText variant="title">What happened</AppText>
              {a.timeline.map((e, i) => (
                <View key={`${e.type}-${e.createdAt}-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.event}>
                    <View style={styles.eventText}>
                      <AppText variant="bodyStrong">{eventLabel(e.type)}</AppText>
                      {e.note ? (
                        <AppText variant="small" tone="muted">
                          {e.note}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText variant="caption" tone="muted">
                      {formatWhen(e.createdAt, a.timezone)}
                    </AppText>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  );
};

export default AppointmentLookup;
