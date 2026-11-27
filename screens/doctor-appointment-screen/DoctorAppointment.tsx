// ═══════════════════════════════════════════════════════
// MetroMatrix — An appointment (the doctor's side)
// ═══════════════════════════════════════════════════════
// The patient (age, phone, visits with you, missed and late-cancelled ones),
// the visit's status and the ONE next step the server allows now (Check in,
// Start, Complete — only on the visit's day; Join for video), then in
// section cards: payment (a transfer to check, a refund to record), why
// they're coming, the reports they shared, the prescription, private notes
// with their files, and your earlier visits. "Mark as missed" and Cancel ask
// first; a cancelled visit says who cancelled, why, and whether it was late.

import React, { useCallback, useEffect } from 'react';
import { NO_ERROR } from '../shared/formStatus';
import { Linking, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
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
  type IonName,
  ListRow,
  PrescriptionSheet,
  RowCardsSkeleton,
  ScreenShell,
  SectionCard,
  Sheet,
  StatusPill,
  StatusTimeline,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS, KIND_LABEL, appointmentTimeline } from '../../models/health/appointmentStatusModel';
import { REASON_TAGS } from '../../models/health/bookingModel';
import { genderLabel } from '../../models/health/familyMemberModel';
import { isPdf, recordTypeLabel } from '../../models/health/recordModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { dateInZone, elapsed, formatDayFull, formatOn, formatTimeRange, formatWhen, todayInZone } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { callNumber } from '../../utils/maps/maps';
import { haptics } from '../../utils/haptics/haptics';
import { pickDocumentFile } from '../../utils/pickers/pickers';
import { useNow } from '../../hooks/useNow';
import { selectDoctorFeatures } from '../../store/doctorFeaturesSlice';
import { VisitTimeSheet } from '../visit-time-sheet/VisitTimeSheet';
import { clearVisitTimeDone, openVisitTime, selectVisitTime } from '../visit-time-sheet/visitTimeSlice';
import { addDays } from '../../utils/health-time/healthTime';
import {
  attachNoteFileAsync,
  closeDoctorSheet,
  doctorMoveAsync,
  loadDoctorAppointmentAsync,
  openDoctorSheet,
  openSharedRecordAsync,
  removeNoteFile,
  selectDoctorAppointmentEntry,
  selectDoctorAppointmentUi,
  setNotesDraft,
  setSheetReason,
  viewFile,
  type DoctorMove,
} from './doctorAppointmentSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorAppointment'>;

/** The API's limits: a reason 3–500 characters, a refund reference 3–100. */
const REASON_MAX = 500;
const REFUND_REF_MAX = 100;

const CANCELLED_BY_LABEL = { patient: 'the patient', doctor: 'you', system: 'MetroMatrix' } as const;

const makeStyles = ({ space, colors, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    patient: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    stats: { flexDirection: 'row', borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
    stat: { flex: 1, alignItems: 'center', gap: space.s0, paddingVertical: space.s12 },
    rule: { width: size.hairline, backgroundColor: colors.line },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s8 },
    actions: { gap: space.s12 },
    file: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  });

const DoctorAppointment: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorAppointmentContent {...props} />
  </ServiceScope>
);

const DoctorAppointmentContent: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'DoctorTabs' });
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const entry = useAppSelector(st => selectDoctorAppointmentEntry(st, id));
  const shared = useAppSelector(selectDoctorAppointmentUi);
  // A move, a sheet or an error belongs to the visit it was made on: another
  // visit's page (a follow-up opened over this one) reads none of it.
  const ui = React.useMemo(
    () =>
      shared.uiFor === id || shared.uiFor === null
        ? shared
        : { ...shared, busy: null, sheet: { kind: null, reason: '' }, viewing: null, openingRecord: null, attaching: false, error: NO_ERROR },
    [shared, id],
  );
  const now = useNow();
  const a = entry.appointment;
  const { features } = useAppSelector(selectDoctorFeatures);
  const visitTime = useAppSelector(selectVisitTime);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadDoctorAppointmentAsync(id));
    }, [dispatch, id]),
  );

  // A move or a follow-up made a new visit: say so, and open it.
  useEffect(() => {
    if (!visitTime.done || visitTime.appointmentId !== id) return;
    const code = visitTime.done;
    const moved = visitTime.mode === 'move';
    dispatch(clearVisitTimeDone());
    haptics.success();
    Toast.show({ type: 'success', text1: moved ? 'Visit moved' : 'Follow-up booked', text2: 'The patient has been told.' });
    if (moved) navigation.replace('DoctorAppointment', { id: code });
    else navigation.push('DoctorAppointment', { id: code });
  }, [visitTime.done, visitTime.appointmentId, visitTime.mode, id, dispatch, navigation]);

  if (!a) {
    return (
      <ScreenShell title="Appointment" onBack={back}>
        {entry.status === 'failed' ? (
          <InlineNotice message={entry.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadDoctorAppointmentAsync(id)) }} />
        ) : (
          <RowCardsSkeleton count={4} />
        )}
      </ScreenShell>
    );
  }

  const move = async (
    m: DoctorMove,
    extra: { reason?: string; paymentCollected?: boolean; notes?: string; files?: string[] } = {},
    done?: string,
  ) => {
    const r = await dispatch(doctorMoveAsync({ id, move: m, ...extra }));
    if (doctorMoveAsync.fulfilled.match(r)) {
      haptics.success();
      if (done) Toast.show({ type: 'success', text1: done });
      // Completed: the prescription now, while it's fresh (it stays editable for 24 hours).
      const after = selectDoctorAppointmentEntry(store.getState(), id).appointment;
      if (m === 'complete' && after?.actions.canWritePrescription && !after.prescription)
        Alert.alert('Visit complete', 'Write the prescription now, while it’s fresh?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Write prescription', onPress: () => navigation.navigate('PrescriptionWriter', { appointmentId: id }) },
        ]);
    } else haptics.warning();
  };

  const status = APPOINTMENT_STATUS[a.status];
  const act = a.actions;
  const p = a.patient;
  const notes = ui.notes[id] ?? a.notes.text;
  const noteFiles = ui.noteFiles[id] ?? a.notes.attachments;
  const notesChanged = notes !== a.notes.text || JSON.stringify(noteFiles) !== JSON.stringify(a.notes.attachments);
  const rx = a.prescription;
  const rxEditable = !!rx && Date.parse(rx.editableUntil) > now;
  const writeRx = () => navigation.navigate('PrescriptionWriter', { appointmentId: id });
  const sheetKind = ui.sheet.kind;
  // Check in and Start: a server that gates them (from 2 hours before) says so in `can`;
  // an older one is held to the visit's own day here.
  const serverGates = features.includes('day_status');
  const onItsDay = serverGates || dateInZone(a.startAt, a.timezone) === todayInZone(a.timezone, now);
  const canCheckIn = act.canCheckIn && onItsDay;
  const canStart = act.canStart && onItsDay;
  const booked = a.status === 'confirmed' || a.status === 'awaiting_payment';
  const notYet = booked && a.kind === 'clinic' && !act.canCheckIn && Date.parse(a.startAt) > now;
  // Both pick from the doctor's own free times: a server without them can't offer either.
  const ownSlots = features.includes('doctor_slots');
  const canMove = booked && ownSlots && features.includes('doctor_reschedule');
  const canFollowUp = (a.status === 'in_progress' || a.status === 'completed') && ownSlots && features.includes('follow_up_booking');
  const join = () => navigation.navigate('VideoPrecheck', { appointmentId: id });
  // The ONE next step, in the footer; the rarer moves wait under "More actions".
  const primary: { label: string; icon?: IonName; busy?: DoctorMove; onPress: () => void } | null = act.canJoinVideo
    ? { label: 'Join video consultation', icon: 'videocam-outline', onPress: join }
    : act.canComplete
      ? { label: 'Complete the visit', icon: 'checkmark-done-outline', onPress: () => dispatch(openDoctorSheet('complete')) }
      : canStart
        ? { label: 'Start consultation', busy: 'start', onPress: () => void move('start') }
        : canCheckIn
          ? { label: 'Check in', busy: 'check-in', onPress: () => void move('check-in', {}, 'Checked in') }
          : act.canWritePrescription
            ? { label: rx ? 'Edit prescription' : 'Write prescription', icon: 'create-outline', onPress: () => navigation.navigate('PrescriptionWriter', { appointmentId: id }) }
            : null;
  const more = canMove || canFollowUp || act.canNoShow || act.canCancel;
  const place = { id: a.location.id, name: a.location.name, kind: a.location.kind };
  const openMove = () => dispatch(openVisitTime({ mode: 'move', appointmentId: id, location: place, from: null }));
  const openFollowUp = () =>
    dispatch(
      openVisitTime({
        mode: 'follow_up',
        appointmentId: id,
        location: place,
        // From the follow-up the prescription asks for, when it does.
        from: rx?.followUpInDays ? addDays(todayInZone(a.timezone, now), rx.followUpInDays) : null,
      }),
    );
  const reasonLength = ui.sheet.reason.trim().length;

  const confirmMissed = () =>
    Alert.alert(`Mark ${p.name} as missed?`, "Only if they didn't come. It counts toward their missed visits.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark missed', style: 'destructive', onPress: () => void move('no-show', {}, 'Marked as missed') },
    ]);

  const attachFile = async () => {
    const file = await pickDocumentFile();
    if (file) void dispatch(attachNoteFileAsync({ id, file }));
  };

  const openFile = (url: string) => (/\.pdf($|\?)/i.test(url) ? void Linking.openURL(url) : dispatch(viewFile(url)));

  return (
    <ScreenShell
      title={p.name}
      subtitle={`${a.code} · ${KIND_LABEL[a.kind]} · ${formatWhen(a.startAt, a.timezone)}`}
      onBack={back}
      footer={
        primary || more ? (
          <View style={styles.footer}>
            {primary ? (
              <View style={styles.grow}>
                <Button label={primary.label} leftIcon={primary.icon} onPress={primary.onPress} loading={!!primary.busy && ui.busy === primary.busy} fullWidth />
              </View>
            ) : null}
            {more ? (
              primary ? (
                <IconButton icon="ellipsis-horizontal" onPress={() => dispatch(openDoctorSheet('more'))} accessibilityLabel="More actions" />
              ) : (
                <View style={styles.grow}>
                  <Button label="More actions" variant="secondary" leftIcon="ellipsis-horizontal" onPress={() => dispatch(openDoctorSheet('more'))} fullWidth />
                </View>
              )
            ) : null}
          </View>
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
        {p.id ? <TextAction label="Full history with you" icon="time-outline" onPress={() => navigation.navigate('PatientHistory', { id: p.id, name: p.name })} /> : null}
      </Card>
      <View style={styles.stats}>
        {[
          ['Visits with you', p.visitsWithYou],
          ['Missed', p.noShows],
          ['Late cancels', p.lateCancels],
        ].map(([l, n], i) => (
          <React.Fragment key={l as string}>
            {i > 0 ? <View style={styles.rule} /> : null}
            <View style={styles.stat} accessible accessibilityLabel={`${l}: ${n}`}>
              <AppText variant="title">{String(n)}</AppText>
              <AppText variant="caption" tone="muted">
                {l as string}
              </AppText>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.row}>
        <StatusPill label={status.label} tone={status.tone} />
        {a.source === 'walk_in' ? <StatusPill label="Walk-in" tone="neutral" /> : a.followUpOfId ? <StatusPill label="Follow-up" tone="neutral" /> : null}
        {a.status === 'checked_in' && a.checkedInAt ? <AppText variant="small" tone="warning">{`Waiting ${elapsed(a.checkedInAt, now)}`}</AppText> : null}
        <AppText variant="small" tone="muted">
          {formatTimeRange(a.startAt, a.endAt, a.timezone)}
        </AppText>
      </View>

      {a.cancellation ? (
        <InlineNotice
          tone="info"
          title={`Cancelled by ${a.cancellation.by ? CANCELLED_BY_LABEL[a.cancellation.by] : 'someone'}${a.cancellation.late ? ' · late cancellation' : ''}`}
          message={a.cancellation.reason ?? 'No reason was given.'}
        />
      ) : null}

      {/* The footer holds the one next step; a second one that can happen now sits here. */}
      {act.canJoinVideo && canStart ? (
        <Button label="Start consultation" variant="secondary" onPress={() => void move('start')} loading={ui.busy === 'start'} fullWidth />
      ) : act.canComplete && act.canWritePrescription ? (
        <Button label={rx ? 'Edit prescription' : 'Write prescription'} variant="secondary" leftIcon="create-outline" onPress={writeRx} fullWidth />
      ) : (act.canCheckIn && !onItsDay) || (serverGates && notYet) ? (
        <AppText variant="small" tone="muted">
          {serverGates ? 'Check in opens 2 hours before the visit.' : 'Check in opens on the day of the visit.'}
        </AppText>
      ) : null}

      <SectionCard title="Payment" icon="card-outline">
        <View style={styles.row}>
          <StatusPill label={APPOINTMENT_PAYMENT_STATUS[a.payment.status].label} tone={APPOINTMENT_PAYMENT_STATUS[a.payment.status].tone} />
          <AppText variant="bodyStrong">{formatPKR(a.payment.amount)}</AppText>
        </View>
        {a.payment.proof ? <AppText variant="body">{`Transaction ${a.payment.proof.transactionId} · sent ${formatOn(a.payment.proof.submittedAt)}`}</AppText> : null}
        {a.payment.proof?.imageUrl ? (
          <TextAction label="See the receipt" icon="image-outline" onPress={() => dispatch(viewFile(a.payment.proof!.imageUrl))} />
        ) : null}
        {act.canConfirmPayment ? (
          <>
            <AppText variant="small" tone="muted">
              Check your own account for this transaction, then confirm.
            </AppText>
            <Button
              label="Confirm payment received"
              onPress={() => void move('confirm-payment', {}, 'Payment confirmed')}
              loading={ui.busy === 'confirm-payment'}
              fullWidth
            />
            <Button label="I can't find it" variant="ghost" onPress={() => dispatch(openDoctorSheet('reject'))} fullWidth />
          </>
        ) : null}
        {act.canMarkPaid ? (
          <Button
            label="Mark the fee as paid"
            variant="secondary"
            leftIcon="cash-outline"
            onPress={() => void move('mark-paid', {}, 'Marked as paid')}
            loading={ui.busy === 'mark-paid'}
            fullWidth
          />
        ) : null}
        {act.canRefund ? (
          <>
            <AppText variant="small" tone="muted">
              This visit was cancelled after it was paid. Send the fee back from your account, then record it here.
            </AppText>
            <Button label="Record the refund" variant="secondary" leftIcon="return-down-back-outline" onPress={() => dispatch(openDoctorSheet('refund'))} fullWidth />
          </>
        ) : null}
      </SectionCard>

      {a.reasonTags.length || a.reason ? (
        <SectionCard title="Why they're coming" icon="chatbubble-ellipses-outline">
          {a.reasonTags.length ? <AppText variant="body">{a.reasonTags.map(t => REASON_TAGS.find(x => x.key === t)?.label ?? t).join(', ')}</AppText> : null}
          {a.reason ? <AppText variant="body">{a.reason}</AppText> : null}
        </SectionCard>
      ) : null}

      {/* A walk-in has no account to share reports from. */}
      {a.source === 'walk_in' ? null : (
      <SectionCard title="Reports they shared" icon="document-attach-outline">
        {a.records.length ? (
          a.records.map((r, k) => (
            <View key={r.id} style={styles.grow}>
              {k > 0 ? <Divider /> : null}
              <AppText variant="bodyStrong">{r.title}</AppText>
              <AppText variant="caption" tone="muted">{`${recordTypeLabel(r.type)} · ${r.memberName} · ${r.recordedOn ? formatDayFull(r.recordedOn) : ''}`}</AppText>
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
      </SectionCard>
      )}

      {rx ? (
        <View style={styles.actions}>
          <PrescriptionSheet prescription={rx} />
          {rxEditable ? null : <InlineNotice tone="info" message="A prescription can be changed for 24 hours after the visit is completed." />}
        </View>
      ) : null}

      <SectionCard title="Progress" icon="git-commit-outline">
        <StatusTimeline steps={appointmentTimeline(a.status, a.kind, a.payment.method === 'transfer')} />
      </SectionCard>

      <SectionCard title="Private notes" subtitle="Only you see these." icon="lock-closed-outline">
        <TextField
          label="Notes"
          value={notes}
          onChangeText={t => dispatch(setNotesDraft({ id, text: t }))}
          multiline
          maxLength={4000}
          placeholder="Findings, plan, what to check next time"
          editable={a.status !== 'cancelled'}
        />
        {noteFiles.length ? (
          <View style={styles.file}>
            {noteFiles.map((url, i) => (
              <View key={url} style={styles.row}>
                <TextAction label={`File ${i + 1}`} icon="attach-outline" onPress={() => openFile(url)} />
                <IconButton icon="close" tone="muted" onPress={() => dispatch(removeNoteFile({ id, url }))} accessibilityLabel={`Remove file ${i + 1}`} />
              </View>
            ))}
          </View>
        ) : null}
        {a.status !== 'cancelled' ? (
          <View style={styles.row}>
            <TextAction label={ui.attaching ? 'Uploading…' : 'Attach a file'} icon="attach-outline" onPress={() => void attachFile()} disabled={ui.attaching} />
            <Button
              label="Save notes"
              variant="secondary"
              size="sm"
              onPress={() => void move('notes', { notes, files: noteFiles }, 'Notes saved')}
              loading={ui.busy === 'notes'}
              disabled={!notesChanged || ui.attaching}
            />
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            {"A cancelled visit's notes can't be changed."}
          </AppText>
        )}
      </SectionCard>

      {a.previousVisits.length ? (
        <SectionCard title="Other visits with you" icon="time-outline">
          {a.previousVisits.map((v, i) => (
            <View key={v.code}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={v.diagnosis ?? `${KIND_LABEL[v.kind]} visit`}
                subtitle={[formatOn(v.startAt), v.notes].filter(Boolean).join(' · ')}
                leftIcon={v.kind === 'video' ? 'videocam-outline' : 'business-outline'}
                right={v.status === 'completed' ? undefined : <StatusPill label={APPOINTMENT_STATUS[v.status].label} tone={APPOINTMENT_STATUS[v.status].tone} />}
                onPress={v.appointmentId ? () => navigation.push('DoctorAppointment', { id: v.appointmentId }) : undefined}
                chevron={!!v.appointmentId}
              />
            </View>
          ))}
        </SectionCard>
      ) : null}

      <Sheet visible={sheetKind === 'more'} onClose={() => dispatch(closeDoctorSheet())} title="More actions" subtitle={`${p.name} · ${formatWhen(a.startAt, a.timezone)}`}>
        <View>
          {canMove ? (
            <ListRow
              title="Move to another time"
              subtitle="The patient is told why"
              leftIcon="swap-horizontal-outline"
              onPress={() => {
                dispatch(closeDoctorSheet());
                openMove();
              }}
            />
          ) : null}
          {canFollowUp ? (
            <ListRow
              title="Book a follow-up"
              subtitle="For the same person, on your own times"
              leftIcon="calendar-outline"
              onPress={() => {
                dispatch(closeDoctorSheet());
                openFollowUp();
              }}
            />
          ) : null}
          {act.canNoShow ? (
            <ListRow
              title="Mark as missed"
              subtitle="Only if they didn't come"
              leftIcon="close-circle-outline"
              onPress={() => {
                dispatch(closeDoctorSheet());
                confirmMissed();
              }}
            />
          ) : null}
          {act.canCancel ? (
            <ListRow title="Cancel this appointment" subtitle="The patient sees your reason" leftIcon="trash-outline" destructive onPress={() => dispatch(openDoctorSheet('cancel'))} />
          ) : null}
        </View>
      </Sheet>

      <Sheet
        visible={!!sheetKind && sheetKind !== 'more'}
        onClose={() => dispatch(closeDoctorSheet())}
        title={
          sheetKind === 'complete'
            ? 'Complete the visit'
            : sheetKind === 'reject'
              ? 'Payment not found'
              : sheetKind === 'refund'
                ? 'Record the refund'
                : 'Cancel this appointment'
        }
        subtitle={
          sheetKind === 'complete' && a.payment.method === 'pay_at_visit'
            ? 'Was the fee paid at the visit?'
            : sheetKind === 'refund'
              ? 'The reference of the transfer you sent back.'
              : sheetKind === 'complete'
                ? undefined
                : 'The patient sees your reason.'
        }
        footer={
          sheetKind === 'complete' ? (
            a.payment.method === 'pay_at_visit' ? (
              <>
                <Button
                  label="Yes, paid"
                  onPress={() => void move('complete', { paymentCollected: true }, 'Visit complete')}
                  loading={ui.busy === 'complete'}
                  fullWidth
                />
                <Button label="Not paid" variant="secondary" onPress={() => void move('complete', { paymentCollected: false }, 'Visit complete')} disabled={ui.busy === 'complete'} fullWidth />
              </>
            ) : (
              <Button label="Complete" onPress={() => void move('complete', {}, 'Visit complete')} loading={ui.busy === 'complete'} fullWidth />
            )
          ) : sheetKind === 'refund' ? (
            <Button
              label="Record the refund"
              onPress={() => void move('refund', { reason: ui.sheet.reason }, 'Refund recorded')}
              loading={ui.busy === 'refund'}
              disabled={reasonLength < 3}
              fullWidth
            />
          ) : (
            <Button
              label={sheetKind === 'reject' ? 'Tell the patient' : 'Cancel and tell the patient'}
              variant={sheetKind === 'cancel' ? 'destructive' : 'primary'}
              onPress={() =>
                void move(
                  sheetKind === 'reject' ? 'reject-payment' : 'cancel',
                  { reason: ui.sheet.reason },
                  sheetKind === 'reject' ? 'The patient has been told' : 'Appointment cancelled',
                )
              }
              loading={ui.busy === 'cancel' || ui.busy === 'reject-payment'}
              disabled={reasonLength < 3}
              fullWidth
            />
          )
        }>
        {ui.error.message ? <InlineNotice message={ui.error.message} /> : null}
        {sheetKind === 'complete' ? (
          <View style={styles.row}>
            <IonIcon name="information-circle-outline" size="md" color={service.accentDeep} />
            <AppText variant="small" tone="muted" style={styles.grow}>
              You can write the prescription after completing too (for 24 hours you can still change it).
            </AppText>
          </View>
        ) : (
          <TextField
            label={sheetKind === 'refund' ? 'Refund reference' : 'Reason'}
            value={ui.sheet.reason}
            onChangeText={t => dispatch(setSheetReason(t))}
            multiline={sheetKind !== 'refund'}
            maxLength={sheetKind === 'refund' ? REFUND_REF_MAX : REASON_MAX}
            helper={reasonLength < 3 ? 'At least 3 characters.' : undefined}
            placeholder={
              sheetKind === 'refund' ? 'IBFT 99120' : sheetKind === 'reject' ? 'No transfer with this ID reached my account' : 'I am not available at this time'
            }
          />
        )}
      </Sheet>
      <ImageViewer visible={!!ui.viewing} uri={ui.viewing} title={p.name} onClose={() => dispatch(viewFile(null))} />
      <VisitTimeSheet />
    </ScreenShell>
  );
};

export default DoctorAppointment;
