// ═══════════════════════════════════════════════════════
// MetroMatrix — An appointment (the doctor's side)
// ═══════════════════════════════════════════════════════
// The patient (age, phone, visits with you, missed and late-cancelled ones),
// why they're coming, the reports they shared, your earlier visits with
// them, private notes, a transfer to check — and the moves allowed now:
// Join, Check in, Start, Complete, Missed, Cancel. "Write prescription" leads
// once the consultation has started.

import React, { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  ImageViewer,
  InlineNotice,
  IonIcon,
  ListRow,
  PrescriptionSheet,
  ScreenShell,
  Sheet,
  SkeletonLines,
  StatusPill,
  StatusTimeline,
  TextAction,
  TextField,
} from '../../../../Custom-Components/index';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS, KIND_LABEL, appointmentTimeline } from '../../../../models/health/appointmentStatusModel';
import { REASON_TAGS } from '../../../../models/health/bookingModel';
import { genderLabel } from '../../../../models/health/familyMemberModel';
import { isPdf, recordTypeLabel } from '../../../../models/health/recordModel';
import type { DoctorPartnerStackParamList } from '../../../../types';
import { elapsed, formatOn, formatTimeRange, formatWhen } from '../../../../utils/healthTime';
import { formatPKR } from '../../../../utils/money';
import { callNumber } from '../../../../utils/maps';
import { haptics } from '../../../../utils/haptics';
import { useNow } from '../../../../hooks/useNow';
import {
  closeDoctorSheet,
  doctorMoveAsync,
  loadDoctorAppointmentAsync,
  openDoctorSheet,
  openSharedRecordAsync,
  selectDoctorAppointmentEntry,
  selectDoctorAppointmentUi,
  setNotesDraft,
  setSheetReason,
  viewFile,
  type DoctorMove,
} from './doctorAppointmentSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorAppointment'>;

const makeStyles = ({ space, radius, colors }: Theme) =>
  StyleSheet.create({
    patient: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    stats: { flexDirection: 'row', gap: space.s8 },
    stat: { flex: 1, alignItems: 'center', paddingVertical: space.s8, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s8 },
    actions: { gap: space.s12 },
    file: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const DoctorAppointmentScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorAppointmentContent {...props} />
  </ServiceScope>
);

const DoctorAppointmentContent: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'DoctorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const entry = useAppSelector(st => selectDoctorAppointmentEntry(st, id));
  const ui = useAppSelector(selectDoctorAppointmentUi);
  const now = useNow();
  const a = entry.appointment;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadDoctorAppointmentAsync(id));
    }, [dispatch, id]),
  );

  if (!a) {
    return (
      <ScreenShell title="Appointment" onBack={back}>
        {entry.status === 'failed' ? <InlineNotice message={entry.error.message} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const move = async (m: DoctorMove, extra: { reason?: string; paymentCollected?: boolean; notes?: string } = {}, done?: string) => {
    const r = await dispatch(doctorMoveAsync({ id, move: m, ...extra }));
    if (doctorMoveAsync.fulfilled.match(r)) {
      haptics.success();
      if (done) Toast.show({ type: 'success', text1: done });
    } else haptics.warning();
  };

  const status = APPOINTMENT_STATUS[a.status];
  const act = a.actions;
  const p = a.patient;
  const notes = ui.notes[id] ?? a.notes.text;
  const rx = a.prescription;
  const rxEditable = !!rx && Date.parse(rx.editableUntil) > now;
  const writeRx = () => navigation.navigate('PrescriptionWriter', { appointmentId: id });
  const sheetKind = ui.sheet.kind;

  return (
    <ScreenShell
      title={p.name}
      subtitle={`${KIND_LABEL[a.kind]} · ${formatWhen(a.startAt, a.timezone)}`}
      onBack={back}
      footer={
        act.canWritePrescription ? (
          <Button label="Write prescription" leftIcon="create-outline" onPress={writeRx} fullWidth />
        ) : act.canJoinVideo ? (
          <Button label="Join video consultation" leftIcon="videocam" onPress={() => navigation.navigate('VideoPrecheck', { appointmentId: id })} fullWidth />
        ) : undefined
      }
      refreshing={entry.status === 'loading'}
      onRefresh={() => void dispatch(loadDoctorAppointmentAsync(id))}>
      {ui.error.message && !sheetKind ? <InlineNotice message={ui.error.message} /> : null}

      <Card>
        <View style={styles.patient}>
          <Avatar name={p.name} size="md" />
          <View style={styles.grow}>
            <AppText variant="title">{p.name}</AppText>
            <AppText variant="small" tone="muted">
              {[p.age !== null ? `${p.age} years` : null, genderLabel(p.gender)].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          {p.phone ? <IconButton icon="call-outline" onPress={() => void callNumber(p.phone!)} accessibilityLabel={`Call ${p.name}`} /> : null}
        </View>
        <View style={styles.stats}>
          {[
            ['Visits with you', p.visitsWithYou],
            ['Missed', p.noShows],
            ['Late cancels', p.lateCancels],
          ].map(([l, n]) => (
            <View key={l as string} style={styles.stat} accessible accessibilityLabel={`${l}: ${n}`}>
              <AppText variant="title">{String(n)}</AppText>
              <AppText variant="caption" tone="muted">
                {l as string}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.row}>
        <StatusPill label={status.label} tone={status.tone} />
        {a.status === 'checked_in' && a.checkedInAt ? <AppText variant="small" tone="warning">{`Waiting ${elapsed(a.checkedInAt, now)}`}</AppText> : null}
        <AppText variant="small" tone="muted">
          {formatTimeRange(a.startAt, a.endAt, a.timezone)}
        </AppText>
      </View>

      <View style={styles.actions}>
        {act.canCheckIn ? <Button label="Check in" onPress={() => void move('check-in', {}, 'Checked in')} loading={ui.busy === 'check-in'} fullWidth /> : null}
        {act.canStart ? <Button label="Start consultation" variant={act.canJoinVideo ? 'secondary' : 'primary'} onPress={() => void move('start')} loading={ui.busy === 'start'} fullWidth /> : null}
        {act.canComplete ? <Button label="Complete" onPress={() => dispatch(openDoctorSheet('complete'))} fullWidth /> : null}
        {act.canNoShow ? <Button label="Mark as missed" variant="ghost" onPress={() => void move('no-show', {}, 'Marked as missed')} loading={ui.busy === 'no-show'} fullWidth /> : null}
      </View>

      {a.payment.method === 'transfer' ? (
        <Card>
          <AppText variant="label">Payment</AppText>
          <View style={styles.row}>
            <StatusPill label={APPOINTMENT_PAYMENT_STATUS[a.payment.status].label} tone={APPOINTMENT_PAYMENT_STATUS[a.payment.status].tone} />
            <AppText variant="bodyStrong">{formatPKR(a.payment.amount)}</AppText>
          </View>
          {a.payment.proof ? (
            <AppText variant="body">{`Transaction ${a.payment.proof.transactionId} · sent ${formatOn(a.payment.proof.submittedAt)}`}</AppText>
          ) : null}
          {a.payment.proof?.imageUrl ? <TextAction label="See the receipt" icon="image-outline" onPress={() => dispatch(viewFile(a.payment.proof!.imageUrl))} /> : null}
          {act.canConfirmPayment ? (
            <>
              <AppText variant="small" tone="muted">
                Check your own account for this transaction, then confirm.
              </AppText>
              <Button label="Confirm payment received" onPress={() => void move('confirm-payment', {}, 'Payment confirmed')} loading={ui.busy === 'confirm-payment'} fullWidth />
              <Button label="I can't find it" variant="ghost" onPress={() => dispatch(openDoctorSheet('reject'))} fullWidth />
            </>
          ) : null}
        </Card>
      ) : (
        <Card>
          <AppText variant="label">Payment</AppText>
          <AppText variant="body">{`${APPOINTMENT_PAYMENT_STATUS[a.payment.status].label} · ${formatPKR(a.payment.amount)}`}</AppText>
        </Card>
      )}

      {a.reasonTags.length || a.reason ? (
        <Card>
          <AppText variant="label">Reason</AppText>
          {a.reasonTags.length ? <AppText variant="body">{a.reasonTags.map(t => REASON_TAGS.find(x => x.key === t)?.label ?? t).join(', ')}</AppText> : null}
          {a.reason ? <AppText variant="body">{a.reason}</AppText> : null}
        </Card>
      ) : null}

      <Card>
        <AppText variant="label">Reports shared by the patient</AppText>
        {a.records.length ? (
          a.records.map(r => (
            <View key={r.id} style={styles.grow}>
              <AppText variant="bodyStrong">{r.title}</AppText>
              <AppText variant="caption" tone="muted">{`${recordTypeLabel(r.type)} · ${r.memberName} · ${r.recordedOn}`}</AppText>
              <View style={styles.file}>
                {!r.files.length ? (
                  <TextAction
                    label={ui.openingRecord === r.id ? 'Opening…' : 'Open report'}
                    icon="eye-outline"
                    onPress={() => void dispatch(openSharedRecordAsync({ id: a.id, recordId: r.id }))}
                  />
                ) : null}
                {r.files.map((f, i) => (
                  <TextAction
                    key={f.url}
                    label={isPdf(f.mime) ? `PDF ${i + 1}` : `Page ${i + 1}`}
                    icon={isPdf(f.mime) ? 'document-attach-outline' : 'image-outline'}
                    onPress={() => (isPdf(f.mime) ? void Linking.openURL(f.url) : dispatch(viewFile(f.url)))}
                  />
                ))}
              </View>
            </View>
          ))
        ) : (
          <AppText variant="small" tone="muted">
            None shared.
          </AppText>
        )}
      </Card>

      {rx ? (
        <View style={styles.actions}>
          <PrescriptionSheet prescription={rx} />
          {rxEditable ? (
            <Button label="Edit prescription" variant="secondary" leftIcon="create-outline" onPress={writeRx} fullWidth />
          ) : (
            <InlineNotice tone="info" message="Prescriptions can be changed for 24 hours after they are written." />
          )}
        </View>
      ) : null}

      <Card>
        <AppText variant="label">Private notes (only you see them)</AppText>
        <TextField label="Notes" value={notes} onChangeText={t => dispatch(setNotesDraft({ id, text: t }))} multiline maxLength={4000} placeholder="Findings, plan, what to check next time" />
        <Button label="Save notes" variant="secondary" size="sm" onPress={() => void move('notes', { notes }, 'Notes saved')} loading={ui.busy === 'notes'} disabled={notes === a.notes.text} />
      </Card>

      {a.previousVisits.length ? (
        <Card padded="horizontal">
          <AppText variant="label">Earlier visits with you</AppText>
          {a.previousVisits.map((v, i) => (
            <View key={v.code}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={v.diagnosis ?? KIND_LABEL[v.kind]}
                subtitle={[formatOn(v.startAt), v.notes].filter(Boolean).join(' · ')}
                leftIcon={v.kind === 'video' ? 'videocam-outline' : 'business-outline'}
                onPress={v.appointmentId ? () => navigation.push('DoctorAppointment', { id: v.appointmentId }) : undefined}
                chevron={!!v.appointmentId}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <StatusTimeline steps={appointmentTimeline(a.status, a.kind, a.payment.method === 'transfer')} />
      {act.canCancel ? <Button label="Cancel this appointment" variant="ghost" onPress={() => dispatch(openDoctorSheet('cancel'))} fullWidth /> : null}

      <Sheet
        visible={!!sheetKind}
        onClose={() => dispatch(closeDoctorSheet())}
        title={sheetKind === 'complete' ? 'Complete the visit' : sheetKind === 'reject' ? 'Payment not found' : 'Cancel this appointment'}
        subtitle={sheetKind === 'complete' && a.payment.method === 'pay_at_visit' ? 'Was the fee paid at the visit?' : sheetKind === 'complete' ? undefined : 'The patient sees your reason.'}
        footer={
          sheetKind === 'complete' ? (
            a.payment.method === 'pay_at_visit' ? (
              <>
                <Button label="Yes, paid" onPress={() => void move('complete', { paymentCollected: true }, 'Visit complete')} loading={ui.busy === 'complete'} fullWidth />
                <Button label="Not paid" variant="secondary" onPress={() => void move('complete', { paymentCollected: false }, 'Visit complete')} fullWidth />
              </>
            ) : (
              <Button label="Complete" onPress={() => void move('complete', {}, 'Visit complete')} loading={ui.busy === 'complete'} fullWidth />
            )
          ) : (
            <Button
              label={sheetKind === 'reject' ? 'Tell the patient' : 'Cancel and tell the patient'}
              onPress={() => void move(sheetKind === 'reject' ? 'reject-payment' : 'cancel', { reason: ui.sheet.reason }, sheetKind === 'reject' ? 'The patient has been told' : 'Appointment cancelled')}
              loading={ui.busy === 'cancel' || ui.busy === 'reject-payment'}
              disabled={ui.sheet.reason.trim().length < 3}
              fullWidth
            />
          )
        }>
        {ui.error.message ? <InlineNotice message={ui.error.message} /> : null}
        {sheetKind !== 'complete' ? (
          <TextField
            label="Reason"
            value={ui.sheet.reason}
            onChangeText={t => dispatch(setSheetReason(t))}
            multiline
            placeholder={sheetKind === 'reject' ? 'No transfer with this ID reached my account' : 'I am not available at this time'}
          />
        ) : (
          <View style={styles.row}>
            <IonIcon name="information-circle-outline" size="md" color={service.accentDeep} />
            <AppText variant="small" tone="muted" style={styles.grow}>
              You can write the prescription after completing too (for 24 hours you can still change it).
            </AppText>
          </View>
        )}
      </Sheet>
      <ImageViewer visible={!!ui.viewing} uri={ui.viewing} title={p.name} onClose={() => dispatch(viewFile(null))} />
    </ScreenShell>
  );
};

export default DoctorAppointmentScreen;
