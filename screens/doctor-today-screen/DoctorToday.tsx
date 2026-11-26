// ═══════════════════════════════════════════════════════
// MetroMatrix — Today
// ═══════════════════════════════════════════════════════
// The day at a glance (booked, checked in, done, missed) and the queue in
// time order: who, how old, first visit or not, why, and how long they have
// waited since check-in. Each row has the next step only: Check in, Start,
// Complete — or Join for a video consultation inside its window; "Missed"
// asks first. Refreshes every 30 seconds while you look at it, and says so
// when a refresh fails. A doctor who isn't visible to patients is told what
// to fix; a newly listed one is greeted here (not by a toast over the header).

import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useNow } from '../../hooks/useNow';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  CountIconButton,
  EmptyState,
  IonIcon,
  InlineNotice,
  RowCardsSkeleton,
  ScreenShell,
  Sheet,
  StatGridSkeleton,
  StatusPill,
  TextAction,
} from '../../Custom-Components/index';
import { StatGrid } from '../../Components/admin/AdminParts';
import { Alert } from '../../utils/alert/alert';
import { selectBusiness } from '../../store/authSlice';
import { clearJustListed, selectPracticeSetup } from '../practice-setup-screen/practiceSetupSlice';
import { loadUnreadCountAsync, selectUnreadCount } from '../notifications-screen/notificationsSlice';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS } from '../../models/health/appointmentStatusModel';
import { genderLabel } from '../../models/health/familyMemberModel';
import type { DoctorPartnerStackParamList, QueueItem } from '../../models';
import { elapsed, formatLongDate, formatSlot } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { closeComplete, completeVisitAsync, loadTodayAsync, openComplete, queueActionAsync, selectDoctorToday, setTodayLocation } from './doctorTodaySlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorTabs'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    stale: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    chipsWrap: { marginHorizontal: -gutter },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
    item: { flexDirection: 'row', gap: space.s12 },
    time: { width: space.s56, alignItems: 'flex-start', gap: space.s4 },
    grow: { flex: 1, gap: space.s4 },
    nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s12 },
    wait: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

const DoctorToday: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorTodayContent {...props} />
  </ServiceScope>
);

const DoctorTodayContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, motion } = useTheme();
  const s = useAppSelector(selectDoctorToday);
  const business = useAppSelector(selectBusiness);
  const { justListed } = useAppSelector(selectPracticeSetup);
  const unread = useAppSelector(selectUnreadCount);
  const now = useNow(motion.queuePoll);
  const t = s.today;
  const go = navigation as unknown as { navigate: (n: string, p?: object) => void };

  // Load on focus, then quietly every 30 seconds while on screen.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadTodayAsync({ locationId: s.locationId }));
      void dispatch(loadUnreadCountAsync());
      const id = setInterval(() => void dispatch(loadTodayAsync({ locationId: s.locationId, quiet: true })), motion.queuePoll);
      return () => clearInterval(id);
    }, [dispatch, s.locationId, motion.queuePoll]),
  );

  /** Missed counts against the patient: say so and ask first. */
  const confirmMissed = (q: QueueItem) =>
    Alert.alert(`Mark ${q.patient.name} as missed?`, "Only if they didn't come. It counts toward their missed visits.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark missed', style: 'destructive', onPress: () => void act(q, 'no-show') },
    ]);

  const act = async (q: QueueItem, action: 'check-in' | 'start' | 'no-show') => {
    const r = await dispatch(queueActionAsync({ id: q.id, action }));
    if (queueActionAsync.fulfilled.match(r)) {
      haptics.success();
      void dispatch(loadTodayAsync({ locationId: s.locationId, quiet: true }));
    } else haptics.warning();
  };

  const complete = async (id: string, paymentCollected: boolean) => {
    const r = await dispatch(completeVisitAsync({ id, paymentCollected }));
    if (completeVisitAsync.fulfilled.match(r)) {
      haptics.success();
      void dispatch(loadTodayAsync({ locationId: s.locationId, quiet: true }));
    }
    return completeVisitAsync.fulfilled.match(r);
  };

  /** Pay-at-visit asks about the money first; otherwise complete now, then offer the prescription. */
  const startComplete = async (q: QueueItem) => {
    if (q.paymentMethod === 'pay_at_visit') {
      dispatch(openComplete({ id: q.id, payAtVisit: true }));
      return;
    }
    if (await complete(q.id, false)) dispatch(openComplete({ id: q.id, payAtVisit: false }));
  };

  const open = (id: string) => go.navigate('DoctorAppointment', { id });

  const row = (q: QueueItem) => {
    const status = APPOINTMENT_STATUS[q.status];
    const a = q.actions;
    const busy = s.busy === q.id;
    // The row's buttons are siblings of its pressable area: one button may not hold another.
    return (
      <Card key={q.id}>
        <Pressable onPress={() => open(q.id)} accessibilityRole="button" accessibilityLabel={`${formatSlot(q.startAt, q.timezone)}, ${q.patient.name}, ${status.label}. Open`} style={styles.item}>
          <View style={styles.time}>
            <AppText variant="bodyStrong">{formatSlot(q.startAt, q.timezone)}</AppText>
            <IonIcon name={q.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="sm" color={colors.inkMuted} />
          </View>
          <View style={styles.grow}>
            <View style={styles.nameRow}>
              <AppText variant="title">{q.patient.name}</AppText>
              {q.firstVisit ? <StatusPill label="First visit" tone="info" /> : null}
            </View>
            <AppText variant="small" tone="muted">
              {[q.patient.age !== null ? `${q.patient.age} years` : null, genderLabel(q.patient.gender), (t?.locations.length ?? 0) > 1 ? q.locationName : null].filter(Boolean).join(' · ')}
            </AppText>
            {q.reason ? <AppText variant="small">{q.reason}</AppText> : null}
            <View style={styles.nameRow}>
              <StatusPill label={status.label} tone={status.tone} />
              {q.paymentMethod === 'transfer' && q.paymentStatus !== 'paid' ? (
                <StatusPill label={APPOINTMENT_PAYMENT_STATUS[q.paymentStatus].label} tone={APPOINTMENT_PAYMENT_STATUS[q.paymentStatus].tone} />
              ) : null}
              {q.status === 'checked_in' && q.checkedInAt ? (
                <View style={styles.wait} accessibilityLabel={`Waiting ${elapsed(q.checkedInAt, now)}`}>
                  <IonIcon name="hourglass-outline" size="sm" color={colors.warning} />
                  <AppText variant="small" tone="warning">{`Waiting ${elapsed(q.checkedInAt, now)}`}</AppText>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
        {a.canJoinVideo || a.canCheckIn || a.canStart || a.canComplete || a.canNoShow || a.canConfirmPayment ? (
          <View style={styles.actions}>
            {a.canJoinVideo ? <Button label="Join" size="sm" leftIcon="videocam" onPress={() => go.navigate('VideoPrecheck', { appointmentId: q.id })} /> : null}
            {a.canCheckIn ? <Button label="Check in" size="sm" onPress={() => void act(q, 'check-in')} loading={busy} /> : null}
            {a.canStart && !a.canJoinVideo ? <Button label="Start" size="sm" onPress={() => void act(q, 'start')} loading={busy} /> : null}
            {a.canStart && a.canJoinVideo ? <Button label="Start" size="sm" variant="secondary" onPress={() => void act(q, 'start')} loading={busy} /> : null}
            {a.canComplete ? <Button label="Complete" size="sm" onPress={() => void startComplete(q)} loading={busy} /> : null}
            {a.canConfirmPayment ? <TextAction label="Check payment" icon="card-outline" onPress={() => open(q.id)} /> : null}
            {a.canNoShow ? <TextAction label="Missed" icon="close-circle-outline" tone="muted" onPress={() => confirmMissed(q)} /> : null}
          </View>
        ) : null}
        {s.rowError?.id === q.id ? (
          <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
            {s.rowError.message}
          </AppText>
        ) : null}
      </Card>
    );
  };

  const counts = t?.counts;
  const reload = () => void dispatch(loadTodayAsync({ locationId: s.locationId }));
  return (
    <ScreenShell
      title="Today"
      subtitle={t ? formatLongDate(new Date(now).toISOString(), t.timezone) : undefined}
      headerRight={<CountIconButton icon="notifications-outline" count={unread} onPress={() => go.navigate('Notifications')} label="Notifications" />}
      refreshing={s.status === 'loading' && !!t}
      onRefresh={reload}>
      {justListed ? (
        <InlineNotice
          tone="success"
          title="You are listed"
          message="Patients can find and book you now."
          action={{ label: 'Dismiss', onPress: () => dispatch(clearJustListed()) }}
        />
      ) : business && business.isListed === false ? (
        <InlineNotice
          tone="warning"
          title="Patients can't find you right now"
          message="Something in your practice setup needs finishing before patients can book you again. Booked visits stay as they are."
          action={{ label: 'Finish setup', onPress: () => go.navigate('PracticeSetup') }}
        />
      ) : null}
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: reload }} /> : null}
      {!t ? (
        s.status === 'failed' ? null : (
          <>
            <StatGridSkeleton count={4} />
            <RowCardsSkeleton count={3} />
          </>
        )
      ) : (
        <>
          <StatGrid
            columns={2}
            compact
            stats={[
              { key: 'booked', icon: 'calendar-outline', tint: 'blue', value: counts!.booked, label: 'Booked' },
              { key: 'in', icon: 'people-outline', tint: 'teal', value: counts!.checkedIn, label: 'Checked in' },
              { key: 'done', icon: 'checkmark-done-outline', tint: 'green', value: counts!.done, label: 'Done' },
              { key: 'missed', icon: 'close-circle-outline', tint: 'amber', value: counts!.noShow, label: 'Missed' },
            ]}
          />
          {s.stale ? (
            <View style={styles.stale} accessibilityLiveRegion="polite">
              <IonIcon name="cloud-offline-outline" size="sm" color={colors.inkMuted} />
              <AppText variant="caption" tone="muted">
                Couldn’t refresh. Pull down to try again.
              </AppText>
            </View>
          ) : null}
          {t.locations.length > 1 ? (
            <View style={styles.chipsWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <ChoiceChip label="All locations" selected={!s.locationId} onPress={() => dispatch(setTodayLocation(null))} />
                {t.locations.map(l => (
                  <ChoiceChip key={l.id} label={l.name} icon={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} selected={s.locationId === l.id} onPress={() => dispatch(setTodayLocation(l.id))} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          {t.queue.length ? (
            t.queue.map(row)
          ) : (
            <EmptyState
              icon="calendar"
              title="No appointments today"
              body="New bookings appear here as patients make them."
              action={{ label: 'Check your availability', onPress: () => go.navigate('Availability', { tab: 'preview' }) }}
            />
          )}
        </>
      )}

      <Sheet
        visible={!!s.complete.id}
        onClose={() => dispatch(closeComplete())}
        title={s.complete.step === 'payment' ? 'Payment collected?' : 'Visit complete'}
        subtitle={s.complete.step === 'payment' ? 'This visit is paid at the clinic.' : 'Write the prescription now, while it’s fresh?'}
        footer={
          s.complete.step === 'payment' ? (
            <>
              <Button label="Yes, paid" onPress={() => s.complete.id && void complete(s.complete.id, true)} loading={s.complete.answering === 'paid'} disabled={!!s.complete.answering} fullWidth />
              <Button
                label="Not paid"
                variant="secondary"
                onPress={() => s.complete.id && void complete(s.complete.id, false)}
                loading={s.complete.answering === 'not_paid'}
                disabled={!!s.complete.answering}
                fullWidth
              />
            </>
          ) : (
            <>
              <Button
                label="Write prescription"
                leftIcon="create-outline"
                onPress={() => {
                  const id = s.complete.id!;
                  dispatch(closeComplete());
                  go.navigate('PrescriptionWriter', { appointmentId: id });
                }}
                fullWidth
              />
              <Button label="Later" variant="ghost" onPress={() => dispatch(closeComplete())} fullWidth />
            </>
          )
        }>
        {s.completeError ? <InlineNotice message={s.completeError} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default DoctorToday;
