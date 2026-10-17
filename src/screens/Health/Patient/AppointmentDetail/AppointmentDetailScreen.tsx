// ═══════════════════════════════════════════════════════
// MetroMatrix — Appointment detail
// ═══════════════════════════════════════════════════════
// Where the visit stands (status, timeline), who and when and where, the
// reason and shared reports, payment — and only the actions the server
// allows now: Join video, Pay, Reschedule (once, same location), Cancel
// (with a late-cancel note inside the cutoff), View prescription, Rate visit.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useHealthNav } from '@hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  ChoiceChip,
  DateStrip,
  Divider,
  DoctorPhoto,
  IonIcon,
  InlineNotice,
  ListRow,
  PaymentInstructionsCard,
  ScreenShell,
  Sheet,
  SkeletonLines,
  SlotGrid,
  StatusPill,
  StatusTimeline,
  TextAction,
  TextField,
} from '@custom/index';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS, KIND_LABEL, appointmentTimeline } from '@models/health/appointmentStatusModel';
import { CANCEL_REASONS, MAX_REASON, REASON_TAGS, validateCancel } from '@models/health/bookingModel';
import { recordTypeIcon, recordTypeLabel } from '@models/health/recordModel';
import type { IonName } from '@custom/index';
import type { OrdersStackParamList } from '@/types';
import { formatLongDate, formatTimeRange, formatWhen, relativeStart } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { callNumber, openDirections } from '@utils/maps';
import { haptics } from '@utils/haptics';
import {
  attachRecordsAsync,
  cancelAppointmentAsync,
  closeCancelSheet,
  closeRecordsSheet,
  closeReschedule,
  loadAppointmentAsync,
  openCancelSheet,
  openRecordsSheetAsync,
  openRescheduleAsync,
  pickRescheduleSlot,
  rescheduleAsync,
  rescheduleDayAsync,
  selectAppointmentEntry,
  selectAppointmentState,
  setCancelNote,
  setCancelReason,
  togglePickedRecord,
} from './appointmentDetailSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'AppointmentDetail'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    status: { gap: space.s8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s8 },
    doctor: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    line: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    actions: { gap: space.s12 },
    bleed: { marginHorizontal: -gutter },
  });

const AppointmentDetailScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <AppointmentDetailContent {...props} />
  </ServiceScope>
);

const AppointmentDetailContent: React.FC<Props> = ({ route, navigation }) => {
  const { code } = route.params;
  const { back } = useBack({ name: 'HealthTabs', params: { screen: 'AppointmentsTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const nav = useHealthNav();
  const entry = useAppSelector(st => selectAppointmentEntry(st, code));
  const s = useAppSelector(selectAppointmentState);
  const a = entry.appointment;

  // Flags change with the clock (the join window, the cutoff): refresh on focus.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadAppointmentAsync(code));
    }, [dispatch, code]),
  );

  if (!a) {
    return (
      <ScreenShell title="Appointment" subtitle={code} onBack={back}>
        {entry.status === 'failed' ? (
          <InlineNotice message={entry.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadAppointmentAsync(code)) }} />
        ) : (
          <SkeletonLines lines={10} />
        )}
      </ScreenShell>
    );
  }

  const status = APPOINTMENT_STATUS[a.status];
  const video = a.kind === 'video';
  const f = a.flags;
  const soon = relativeStart(a.startAt, undefined, a.endAt);
  const cancelErrors = validateCancel(s.cancelSheet.reason, s.cancelSheet.note);
  const r = s.reschedule;

  const cancel = async () => {
    if (!s.cancelSheet.reason || Object.keys(cancelErrors).length) return;
    const res = await dispatch(cancelAppointmentAsync({ code, reason: s.cancelSheet.reason, note: s.cancelSheet.note }));
    if (cancelAppointmentAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Appointment cancelled', text2: 'The doctor has been told.' });
    }
  };

  const moveTo = async () => {
    if (!r.selected) return;
    const res = await dispatch(rescheduleAsync({ code, startAt: r.selected }));
    if (rescheduleAsync.fulfilled.match(res)) {
      haptics.success();
      // The new time is a new appointment with its own code: show that one.
      if (res.payload.code !== code) navigation.setParams({ code: res.payload.code });
      Toast.show({ type: 'success', text1: 'Appointment moved', text2: formatWhen(res.payload.startAt, res.payload.timezone) });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={video ? 'Video consultation' : 'Clinic visit'}
      subtitle={`Code ${a.code}`}
      onBack={back}
      refreshing={entry.status === 'loading'}
      onRefresh={() => void dispatch(loadAppointmentAsync(code))}>
      {s.actionError.message && !s.cancelSheet.open && !r.open && !s.recordsSheet.open ? <InlineNotice message={s.actionError.message} /> : null}

      <View style={styles.status}>
        <View style={styles.statusRow}>
          <StatusPill label={status.label} tone={status.tone} />
          {soon && (a.status === 'confirmed' || a.status === 'awaiting_payment' || a.status === 'checked_in') ? (
            <AppText variant="small" tone="accentDeep">
              {soon}
            </AppText>
          ) : null}
        </View>
        <AppText variant="body" tone="muted">
          {a.status === 'cancelled' && a.cancelReason ? `${status.description} ${a.cancelReason}.` : status.description}
        </AppText>
      </View>

      {f.canJoinVideo ? (
        <Button label="Join consultation" leftIcon="videocam" onPress={() => navigation.navigate('VideoPrecheck', { code })} fullWidth />
      ) : video && a.joinOpensAt && (a.status === 'confirmed' || a.status === 'awaiting_payment') ? (
        <InlineNotice tone="info" message={`You can join from here 10 minutes before your time (from ${formatWhen(a.joinOpensAt, a.timezone)}).`} />
      ) : null}

      <Card onPress={() => nav.openDoctor(a.doctor.id, { name: a.doctor.name })} accessibilityLabel={`${a.doctor.name}, ${a.doctor.specialty.name}. Open profile`}>
        <View style={styles.doctor}>
          <DoctorPhoto name={a.doctor.name} uri={a.doctor.photoUrl} size="sm" />
          <View style={styles.grow}>
            <AppText variant="title">{a.doctor.name}</AppText>
            <AppText variant="small" tone="muted">
              {a.doctor.specialty.name}
            </AppText>
          </View>
          <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
        </View>
      </Card>

      <Card>
        <View style={styles.line}>
          <IonIcon name="calendar-outline" size="lg" color={service.accentDeep} />
          <View style={styles.grow}>
            <AppText variant="title">{formatLongDate(a.startAt, a.timezone)}</AppText>
            <AppText variant="body">{formatTimeRange(a.startAt, a.endAt, a.timezone)}</AppText>
          </View>
        </View>
        <Divider />
        <View style={styles.line}>
          <IonIcon name={video ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
          <View style={styles.grow}>
            <AppText variant="title">{video ? KIND_LABEL.video : a.location.name}</AppText>
            {video ? (
              <AppText variant="small" tone="muted">
                On your phone. Join from this page.
              </AppText>
            ) : (
              <>
                <AppText variant="body">{a.location.address ?? [a.location.area, a.location.city].filter(Boolean).join(', ')}</AppText>
                {a.location.instructions ? (
                  <AppText variant="small" tone="muted">
                    {a.location.instructions}
                  </AppText>
                ) : null}
                <View style={styles.links}>
                  <TextAction label="Directions" icon="navigate-outline" onPress={() => void openDirections(a.location)} />
                  {a.location.phone ? <TextAction label="Call clinic" icon="call-outline" onPress={() => void callNumber(a.location.phone!)} /> : null}
                </View>
              </>
            )}
          </View>
        </View>
        <Divider />
        <View style={styles.line}>
          <IonIcon name="person-outline" size="lg" color={service.accentDeep} />
          <View style={styles.grow}>
            <AppText variant="title">{a.patient.name}</AppText>
            <AppText variant="small" tone="muted">
              {[a.patient.relation ?? 'You', a.patient.age !== null ? `${a.patient.age} years` : null].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        </View>
      </Card>

      {a.reasonTags.length || a.reason ? (
        <Card>
          <AppText variant="label">Reason</AppText>
          {a.reasonTags.length ? (
            <AppText variant="body">{a.reasonTags.map(t => REASON_TAGS.find(x => x.key === t)?.label ?? t).join(', ')}</AppText>
          ) : null}
          {a.reason ? <AppText variant="body">{a.reason}</AppText> : null}
        </Card>
      ) : null}

      <Card>
        <AppText variant="label">Shared with the doctor</AppText>
        {a.records.length ? (
          a.records.map(rec => (
            <ListRow
              key={rec.id}
              title={rec.title}
              subtitle={`${recordTypeLabel(rec.type)} · ${rec.memberName}`}
              leftIcon={recordTypeIcon(rec.type) as IonName}
              onPress={() => navigation.navigate('RecordDetail', { id: rec.id })}
              chevron
            />
          ))
        ) : (
          <AppText variant="small" tone="muted">
            No reports shared.
          </AppText>
        )}
        {f.canAttachRecords ? (
          <TextAction label="Share reports" icon="attach-outline" onPress={() => void dispatch(openRecordsSheetAsync({ shared: a.records.map(x => x.id) }))} />
        ) : null}
      </Card>

      {a.payment.instructions && (a.payment.method === 'transfer' || a.payment.status !== 'pay_at_visit') ? (
        <PaymentInstructionsCard
          instructions={a.payment.instructions}
          status={a.payment.status}
          proof={a.payment.proof}
          payee="doctor"
          onPaid={f.canPay ? () => navigation.navigate('PaymentProof', { appointmentCode: a.code }) : undefined}
        />
      ) : (
        <Card>
          <AppText variant="label">Payment</AppText>
          <AppText variant="body">{`${APPOINTMENT_PAYMENT_STATUS[a.payment.status].label} · ${formatPKR(a.payment.amount)}`}</AppText>
          <AppText variant="small" tone="muted">
            {APPOINTMENT_PAYMENT_STATUS[a.payment.status].description}
          </AppText>
        </Card>
      )}

      <StatusTimeline steps={appointmentTimeline(a.status, a.kind, a.payment.method === 'transfer')} />

      <View style={styles.actions}>
        {a.prescriptionId ? <Button label="View prescription" leftIcon="document-text-outline" onPress={() => nav.openPrescription(a.prescriptionId!)} fullWidth /> : null}
        {f.canReview ? <Button label="Rate this visit" variant="secondary" leftIcon="star-outline" onPress={() => navigation.navigate('PostConsultReview', { code })} fullWidth /> : null}
        {f.canReschedule ? (
          <Button
            label="Reschedule"
            variant="secondary"
            leftIcon="calendar-outline"
            onPress={() => void dispatch(openRescheduleAsync({ doctorId: a.doctor.id, locationId: a.location.id }))}
            fullWidth
          />
        ) : null}
        {f.canCancel ? <Button label="Cancel appointment" variant="ghost" onPress={() => dispatch(openCancelSheet())} fullWidth /> : null}
        {a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show' ? (
          <Button label="Book again" variant="ghost" onPress={() => nav.openDoctor(a.doctor.id, { locationId: a.location.id })} fullWidth />
        ) : null}
      </View>

      {/* Cancel */}
      <Sheet
        visible={s.cancelSheet.open}
        onClose={() => dispatch(closeCancelSheet())}
        title="Cancel this appointment"
        subtitle={`${a.doctor.name} · ${formatWhen(a.startAt, a.timezone)}`}
        footer={<Button label="Cancel appointment" onPress={() => void cancel()} loading={s.busy === 'cancel'} disabled={!!Object.keys(cancelErrors).length} fullWidth />}>
        {a.isLateCancel && a.lateCancelNote ? <InlineNotice tone="warning" title="Late cancellation" message={a.lateCancelNote} /> : null}
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        <AppText variant="label">Why are you cancelling</AppText>
        <View style={styles.chips}>
          {CANCEL_REASONS.map(c => (
            <ChoiceChip key={c.key} label={c.label} selected={s.cancelSheet.reason === c.key} onPress={() => dispatch(setCancelReason(c.key))} />
          ))}
        </View>
        <TextField
          label={s.cancelSheet.reason === 'other' ? 'Tell the doctor briefly' : 'Anything to add (optional)'}
          value={s.cancelSheet.note}
          onChangeText={t => dispatch(setCancelNote(t))}
          multiline
          maxLength={MAX_REASON}
          error={s.cancelSheet.reason ? cancelErrors.note : undefined}
        />
      </Sheet>

      {/* Reschedule */}
      <Sheet
        visible={r.open}
        onClose={() => dispatch(closeReschedule())}
        title="Choose a new time"
        subtitle={`${video ? KIND_LABEL.video : a.location.name} · you can move it once`}
        footer={
          <Button
            label={r.selected ? `Move to ${formatWhen(r.selected, r.timezone)}` : 'Choose a time'}
            onPress={() => void moveTo()}
            loading={s.busy === 'reschedule'}
            disabled={!r.selected}
            fullWidth
          />
        }>
        {r.alternatives.length ? (
          <>
            <InlineNotice tone="warning" title="That time was just taken" message="Choose one of the next free times:" />
            <View style={styles.chips}>
              {r.alternatives.map(t => (
                <ChoiceChip key={t} label={formatWhen(t, r.timezone)} icon="time-outline" selected={r.selected === t} onPress={() => dispatch(pickRescheduleSlot(t))} />
              ))}
            </View>
          </>
        ) : s.actionError.message ? (
          <InlineNotice message={s.actionError.message} />
        ) : null}
        <View style={styles.bleed}>
          <DateStrip
            days={r.days}
            selected={r.date}
            loading={r.loading && !r.days.length}
            onSelect={date => void dispatch(rescheduleDayAsync({ doctorId: a.doctor.id, locationId: a.location.id, date }))}
          />
        </View>
        <SlotGrid
          slots={r.slots.filter(sl => sl.startAt !== a.startAt)}
          timezone={r.timezone}
          selected={r.selected}
          loading={r.loading}
          onSelect={t => dispatch(pickRescheduleSlot(t))}
          nextAvailable={r.nextAvailable}
          onNextAvailable={date => void dispatch(rescheduleDayAsync({ doctorId: a.doctor.id, locationId: a.location.id, date }))}
        />
      </Sheet>

      {/* Share reports */}
      <Sheet
        visible={s.recordsSheet.open}
        onClose={() => dispatch(closeRecordsSheet())}
        title="Share reports with the doctor"
        footer={
          <Button
            label="Share"
            onPress={() => void dispatch(attachRecordsAsync({ code, recordIds: s.recordsSheet.selected }))}
            loading={s.busy === 'records'}
            fullWidth
          />
        }>
        {s.recordsSheet.loading && !s.recordsSheet.records.length ? <SkeletonLines lines={4} /> : null}
        {s.recordsSheet.records.map(rec => (
          <Checkbox
            key={rec.id}
            checked={s.recordsSheet.selected.includes(rec.id)}
            onToggle={() => dispatch(togglePickedRecord(rec.id))}
            label={
              <View>
                <AppText variant="body">{rec.title}</AppText>
                <AppText variant="caption" tone="muted">{`${recordTypeLabel(rec.type)} · ${rec.memberName}`}</AppText>
              </View>
            }
            accessibilityLabel={`Share ${rec.title}`}
          />
        ))}
        {!s.recordsSheet.loading && !s.recordsSheet.records.length ? (
          <AppText variant="small" tone="muted">
            No records yet.
          </AppText>
        ) : null}
        <TextAction
          label="Upload a new report"
          icon="cloud-upload-outline"
          onPress={() => {
            dispatch(closeRecordsSheet());
            navigation.navigate('RecordUpload', { memberId: a.patient.familyMemberId ?? undefined, attachTo: a.code });
          }}
        />
      </Sheet>
    </ScreenShell>
  );
};

export default AppointmentDetailScreen;
