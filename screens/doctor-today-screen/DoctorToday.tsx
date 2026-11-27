// ═══════════════════════════════════════════════════════
// MetroMatrix — Today (the doctor's dashboard)
// ═══════════════════════════════════════════════════════
// The day at a glance and the one thing to do next:
//   • a header that greets the doctor, with the "Taking new bookings" switch;
//   • why patients can't find them, when they can't (staff, hidden, or a
//     setup step missing: which one);
//   • the day in four numbers (today, here, seen, missed), how far through
//     it they are, and the next free time;
//   • the patient with them now (or waiting longest, or next), with the one
//     step on that visit;
//   • quick actions, the queue in three tabs (here · upcoming · done), what
//     still needs them (transfers, fees, prescriptions, refunds, reviews),
//     the last 7 days, the reviews and the profile's strength.
// The queue refreshes every 30 seconds while on screen and says so when a
// refresh fails; the rest is read once per visit to the tab.

import React, { useCallback, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useNow } from '../../hooks/useNow';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Avatar,
  BarChart,
  Button,
  Card,
  ChoiceChip,
  CountIconButton,
  Divider,
  EmptyState,
  IonIcon,
  InlineNotice,
  ListRow,
  ProgressBar,
  RowCard,
  RowCardsSkeleton,
  ScreenShell,
  SectionCard,
  SegmentTabs,
  Sheet,
  Skeleton,
  TextAction,
} from '../../Custom-Components/index';
import { QuickActionGrid, SectionHead, type QuickAction } from '../../Components/admin/AdminParts';
import { Alert } from '../../utils/alert/alert';
import { selectBusiness } from '../../store/authSlice';
import { clearJustListed, selectPracticeSetup } from '../practice-setup-screen/practiceSetupSlice';
import { loadUnreadCountAsync, selectUnreadCount } from '../notifications-screen/notificationsSlice';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS } from '../../models/health/appointmentStatusModel';
import { genderLabel } from '../../models/health/familyMemberModel';
import {
  STEP_LABEL,
  dayProgress,
  greeting,
  listingNotice,
  needRows,
  nextStep,
  nextUp,
  queueIn,
  queueTabLabel,
  type QueueTabKey,
} from '../../models/health/doctorTodayModel';
import type { DoctorPartnerStackParamList, QueueItem } from '../../models';
import { elapsed, formatLongDate, formatSlot } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { shareText } from '../../utils/share-text/shareText';
import { haptics } from '../../utils/haptics/haptics';
import { SUPPORT_EMAIL } from '../../config/env';
import {
  clearRowError,
  closeComplete,
  completeVisitAsync,
  loadDashboardAsync,
  loadTodayAsync,
  openComplete,
  queueActionAsync,
  selectDoctorToday,
  setQueueTab,
  setTodayLocation,
} from './doctorTodaySlice';
import { loadDoctorFeaturesAsync, selectDoctorFeatures, setAcceptingAsync } from '../../store/doctorFeaturesSlice';
import { setListedAsync } from '../doctor-more-screen/doctorMoreSlice';
import { WalkInSheet } from '../walk-in-sheet/WalkInSheet';
import { clearWalkInAdded, openWalkIn, selectWalkIn } from '../walk-in-sheet/walkInSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorTabs'>;

const makeStyles = ({ colors, service, space, gutter, radius, size, listGap }: Theme) =>
  StyleSheet.create({
    stale: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    chipsWrap: { marginHorizontal: -gutter },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
    section: { gap: space.s12 },
    list: { gap: listGap },
    // The header's bookings switch: white words on a soft white band.
    booking: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s12,
      minHeight: size.touch,
      paddingLeft: space.s16,
      paddingRight: space.s12,
      borderRadius: radius.md,
      backgroundColor: colors.onScrimTint,
    },
    bookingText: { flex: 1, gap: space.s0 },
    // The day at a glance.
    glanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    numbers: { flexDirection: 'row', alignItems: 'stretch' },
    number: { flex: 1, alignItems: 'center', gap: space.s0 },
    rule: { width: size.hairline, backgroundColor: colors.line },
    progress: { gap: space.s8 },
    // The patient with you now: the one solid card on the page.
    hero: { gap: space.s16, padding: space.s20, borderRadius: radius.lg, backgroundColor: service.accent },
    heroHead: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    heroText: { flex: 1, gap: space.s4 },
    heroButton: {
      minHeight: size.control.md,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: space.s8,
      backgroundColor: colors.surface,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s12 },
    strengthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    weekNumbers: { flexDirection: 'row', gap: space.s24 },
    weekNumber: { gap: space.s0 },
  });

const DoctorToday: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorTodayContent {...props} />
  </ServiceScope>
);

/** "10:30 AM" as the list card's time mark: "10:30" over "AM". */
const timeMark = (q: QueueItem) => {
  const [time, part] = formatSlot(q.startAt, q.timezone).split(' ');
  return { time, sub: part };
};

const DoctorTodayContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const styles = useStyles(makeStyles);
  const { colors, service, motion, size, opacity } = useTheme();
  const s = useAppSelector(selectDoctorToday);
  const business = useAppSelector(selectBusiness);
  const { justListed } = useAppSelector(selectPracticeSetup);
  const unread = useAppSelector(selectUnreadCount);
  const doctor = useAppSelector(selectDoctorFeatures);
  const walkIn = useAppSelector(selectWalkIn);
  const now = useNow(motion.queuePoll);
  const t = s.today;
  const d = s.dashboard;
  const go = navigation as unknown as { navigate: (n: string, p?: object) => void };
  const has = (f: string) => doctor.features.includes(f as never);
  const clinics = (t?.locations ?? []).filter(l => l.kind === 'clinic').map(l => ({ id: l.id, name: l.name }));
  const canWalkIn = has('walk_in') && clinics.length > 0;
  const paused = has('pause') && doctor.isAccepting === false;
  const tz = t?.timezone ?? 'Asia/Karachi';

  // A walk-in was added: the queue has them; open their visit.
  useEffect(() => {
    if (!walkIn.added) return;
    const code = walkIn.added;
    dispatch(clearWalkInAdded());
    haptics.success();
    Toast.show({ type: 'success', text1: 'Added to the queue', text2: 'Checked in and waiting.' });
    void dispatch(loadTodayAsync({ locationId: s.locationId, quiet: true }));
    go.navigate('DoctorAppointment', { id: code });
  }, [walkIn.added, dispatch, s.locationId, go]);

  // On focus: the queue, then the dashboard around it (it needs the locations),
  // the bell's count and the server's features (retried if the first read failed).
  // Only the queue polls.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await dispatch(loadTodayAsync({ locationId: s.locationId }));
        const read = selectDoctorToday(store.getState()).today;
        const slots = selectDoctorFeatures(store.getState()).features.includes('doctor_slots');
        void dispatch(loadDashboardAsync({ locationIds: (read?.locations ?? []).map(l => l.id), slots }));
      })();
      void dispatch(loadUnreadCountAsync());
      void dispatch(loadDoctorFeaturesAsync());
      const id = setInterval(() => void dispatch(loadTodayAsync({ locationId: s.locationId, quiet: true })), motion.queuePoll);
      return () => clearInterval(id);
    }, [dispatch, store, s.locationId, motion.queuePoll]),
  );

  const reload = () => {
    void dispatch(loadTodayAsync({ locationId: s.locationId }));
    void dispatch(loadDashboardAsync({ locationIds: (t?.locations ?? []).map(l => l.id), slots: has('doctor_slots') }));
  };

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
    const ok = completeVisitAsync.fulfilled.match(r);
    if (ok) {
      haptics.success();
      void dispatch(loadTodayAsync({ locationId: s.locationId, quiet: true }));
    } else haptics.warning();
    return ok;
  };

  /** Pay-at-visit asks about the money first; otherwise complete now, then offer the prescription. */
  const startComplete = async (q: QueueItem) => {
    if (q.paymentMethod === 'pay_at_visit') {
      dispatch(openComplete({ id: q.id, payAtVisit: true }));
      return;
    }
    if (await complete(q.id, false)) dispatch(openComplete({ id: q.id, payAtVisit: false }));
  };

  const runStep = (q: QueueItem) => {
    const step = nextStep(q);
    if (step === 'join') go.navigate('VideoPrecheck', { appointmentId: q.id });
    else if (step === 'complete') void startComplete(q);
    else if (step === 'start') void act(q, 'start');
    else if (step === 'check-in') void act(q, 'check-in');
  };

  const open = (id: string) => go.navigate('DoctorAppointment', { id });

  const share = async () => {
    if (!doctor.me?.id) return;
    const outcome = await shareText(`${doctor.me.name} on MetroMatrix. Book a visit: metromatrix://health/doctor/${doctor.me.id}`, 'Share your profile');
    if (outcome === 'copied') Toast.show({ type: 'success', text1: 'Link copied' });
    else if (outcome === 'failed') Toast.show({ type: 'error', text1: "The link didn't share", text2: 'Try again.' });
  };

  // ─── Header ──────────────────────────────────────────
  const me = doctor.me;
  const visits = t ? `${t.counts.total} ${t.counts.total === 1 ? 'visit' : 'visits'} today` : null;
  const bookingSwitch = has('pause') && doctor.isAccepting !== null ? (
    <View style={styles.booking}>
      <View style={styles.bookingText}>
        <AppText variant="bodyStrong" tone="onScrim">
          {doctor.isAccepting ? 'Taking new bookings' : 'New bookings paused'}
        </AppText>
      </View>
      <Switch
        value={!!doctor.isAccepting}
        onValueChange={on => void dispatch(setAcceptingAsync(on))}
        disabled={doctor.switching}
        trackColor={{ false: colors.onScrimLine, true: colors.onScrim }}
        thumbColor={doctor.isAccepting ? service.accentDeep : colors.onScrim}
        ios_backgroundColor={colors.onScrimLine}
        {...({ activeThumbColor: service.accentDeep } as object)}
        accessibilityLabel="Taking new bookings"
        accessibilityRole="switch"
        accessibilityState={{ checked: !!doctor.isAccepting, disabled: doctor.switching }}
      />
    </View>
  ) : null;

  // ─── Listing notice ──────────────────────────────────
  const missing = (d.completeness?.items ?? []).filter(i => !i.done).map(i => i.label.toLowerCase());
  const notice = listingNotice(me ?? (business && business.isListed === false ? { isListed: false, hiddenByStaff: null } : null), missing);

  // ─── Queue ───────────────────────────────────────────
  const tabs: QueueTabKey[] = ['waiting', 'upcoming', 'done'];
  const shown = t ? queueIn(t.queue, s.queueTab) : [];
  const many = (t?.locations.length ?? 0) > 1;
  const hero = t ? nextUp(t.queue) : null;

  const row = (q: QueueItem) => {
    const status = APPOINTMENT_STATUS[q.status];
    const payment = APPOINTMENT_PAYMENT_STATUS[q.paymentStatus];
    // ONE pill: a transfer waiting on the doctor outranks the visit's own state.
    const pill = q.paymentMethod === 'transfer' && q.paymentStatus === 'proof_submitted' ? payment : status;
    const who = [q.patient.age !== null ? `${q.patient.age} y` : null, genderLabel(q.patient.gender), many ? q.locationName : q.kind === 'video' ? 'Video' : null]
      .filter(Boolean)
      .join(' · ');
    const why = q.status === 'checked_in' && q.checkedInAt
      ? `Waiting ${elapsed(q.checkedInAt, now)}${q.reason ? ` · ${q.reason}` : ''}`
      : q.reason ?? (q.source === 'walk_in' ? 'Walk-in' : q.firstVisit ? 'First visit' : null);
    const step = nextStep(q);
    const busy = s.busy === q.id;
    const a = q.actions;
    return (
      <RowCard
        key={q.id}
        title={q.patient.name}
        mark={timeMark(q)}
        lines={[who || 'Patient', why]}
        pill={{ label: pill.label, tone: pill.tone }}
        onPress={() => open(q.id)}
        accessibilityLabel={`${formatSlot(q.startAt, q.timezone)}, ${q.patient.name}, ${status.label}. Open`}>
        {step || a.canNoShow || a.canConfirmPayment ? (
          <View style={styles.actions}>
            {step ? <Button label={STEP_LABEL[step]} size="sm" leftIcon={step === 'join' ? 'videocam-outline' : undefined} onPress={() => runStep(q)} loading={busy} /> : null}
            {a.canConfirmPayment ? <TextAction label="Check payment" icon="card-outline" onPress={() => open(q.id)} /> : null}
            {a.canNoShow ? <TextAction label="Missed" icon="close-circle-outline" tone="muted" onPress={() => confirmMissed(q)} /> : null}
          </View>
        ) : null}
        {s.rowError?.id === q.id ? (
          <AppText variant="small" tone="danger" accessibilityLiveRegion="polite" onPress={() => dispatch(clearRowError())}>
            {s.rowError.message}
          </AppText>
        ) : null}
      </RowCard>
    );
  };

  const quick: QuickAction[] = [
    ...(canWalkIn
      ? [{ key: 'walk-in', icon: 'person-add-outline' as const, label: 'Walk-in', onPress: () => dispatch(openWalkIn({ clinics, locationId: clinics.some(c => c.id === s.locationId) ? s.locationId : null })) }]
      : []),
    { key: 'block', icon: 'remove-circle-outline', label: 'Block time', onPress: () => go.navigate('TimeOff') },
    { key: 'hours', icon: 'time-outline', label: 'Hours', onPress: () => go.navigate('Availability', { tab: 'hours' }) },
    ...(me?.id ? [{ key: 'share', icon: 'share-social-outline' as const, label: 'Share', onPress: () => void share() }] : []),
  ];

  const needs = needRows(t?.attention ?? null);
  const week = d.insights;
  const weekVisits = week ? week.perDay.reduce((n, p) => n + p.video + p.clinic, 0) : 0;
  const reviews = d.reviews;
  const strength = d.completeness && d.completeness.percent < 100 ? d.completeness : null;
  const nextMissing = strength?.items.find(i => !i.done);

  return (
    <ScreenShell
      title={greeting(now, tz)}
      subtitle={[me?.name, visits].filter(Boolean).join(' · ') || undefined}
      headerLeading={me ? <Avatar name={me.name.replace(/^(Prof\. |Assoc\. Prof\. |Asst\. Prof\. )?Dr\. /, '')} uri={me.photoUrl} size="md" /> : undefined}
      headerRight={<CountIconButton icon="notifications-outline" count={unread} onPress={() => go.navigate('Notifications')} label="Notifications" />}
      headerContent={bookingSwitch}
      refreshing={s.status === 'loading' && !!t}
      onRefresh={reload}>
      {justListed ? (
        <InlineNotice
          tone="success"
          title="You are listed"
          message="Patients can find and book you now."
          action={{ label: 'Dismiss', onPress: () => dispatch(clearJustListed()) }}
        />
      ) : notice?.kind === 'staff' ? (
        <InlineNotice
          tone="warning"
          title="MetroMatrix staff hid your profile"
          message={`${notice.reason} Visits already booked stay booked. Write to us if you think this is a mistake.`}
          action={{ label: 'Email support', onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=My%20doctor%20profile`) }}
        />
      ) : notice?.kind === 'incomplete' ? (
        <InlineNotice
          tone="warning"
          title="Patients can't find you yet"
          message={`Finish ${notice.missing.join(', ')}. Visits already booked stay booked.`}
          action={{ label: 'Finish setup', onPress: () => go.navigate('PracticeSetup') }}
        />
      ) : notice?.kind === 'hidden_by_you' ? (
        <InlineNotice
          tone="info"
          title="Your profile is hidden"
          message="Patients can't find or book you. Visits already booked stay booked."
          action={{
            label: 'Show my profile',
            onPress: () =>
              void dispatch(setListedAsync(true)).then(() => {
                void dispatch(loadDoctorFeaturesAsync());
              }),
          }}
        />
      ) : null}
      {paused ? (
        <InlineNotice tone="warning" title="New bookings are paused" message="Patients can't book you until you switch bookings back on above. Visits already booked stay." />
      ) : null}
      {doctor.error.message ? <InlineNotice message={doctor.error.message} /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: reload }} /> : null}

      {!t ? (
        s.status === 'failed' ? null : (
          <>
            <Card>
              <Skeleton width="45%" />
              <Skeleton height={size.homeSkeleton.nextVisit} />
            </Card>
            <RowCardsSkeleton count={3} lines={2} pill />
          </>
        )
      ) : (
        <>
          {/* The day at a glance. */}
          <Card>
            <View style={styles.glanceHead}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {formatLongDate(new Date(now).toISOString(), tz)}
              </AppText>
              {d.nextFree ? (
                <AppText variant="small" tone="muted" numberOfLines={1}>{`Next free ${formatSlot(d.nextFree, tz)}`}</AppText>
              ) : d.loaded && has('doctor_slots') ? (
                <AppText variant="small" tone="muted" numberOfLines={1}>
                  No free time left today
                </AppText>
              ) : null}
            </View>
            <View style={styles.numbers} accessible accessibilityLabel={`${t.counts.total} today, ${t.counts.waiting + t.counts.withDoctor} here, ${t.counts.seen} seen, ${t.counts.missed} missed`}>
              {[
                { key: 'total', value: t.counts.total, label: 'Today' },
                { key: 'here', value: t.counts.waiting + t.counts.withDoctor, label: 'Here' },
                { key: 'seen', value: t.counts.seen, label: 'Seen' },
                { key: 'missed', value: t.counts.missed, label: 'Missed' },
              ].map((n, i) => (
                <React.Fragment key={n.key}>
                  {i > 0 ? <View style={styles.rule} /> : null}
                  <View style={styles.number}>
                    <AppText variant="stat">{n.value}</AppText>
                    <AppText variant="caption" tone="muted">
                      {n.label}
                    </AppText>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {t.counts.total ? (
              <View style={styles.progress}>
                <ProgressBar progress={dayProgress(t.counts)} accessibilityLabel={`${t.counts.seen + t.counts.missed} of ${t.counts.total} visits done`} />
                <AppText variant="caption" tone="muted">{`${t.counts.seen + t.counts.missed} of ${t.counts.total} done · ${t.counts.upcoming} still to come`}</AppText>
              </View>
            ) : null}
          </Card>

          {/* The patient with you now, or next. */}
          {hero ? (
            <Pressable onPress={() => open(hero.item.id)} accessibilityRole="button" accessibilityLabel={`${hero.mode === 'with' ? 'With you now' : hero.mode === 'waiting' ? 'Waiting' : 'Next'}: ${hero.item.patient.name}. Open`} style={styles.hero}>
              <View style={styles.heroHead}>
                <Avatar name={hero.item.patient.name} size="md" />
                <View style={styles.heroText}>
                  <AppText variant="small" tone="onAccent" numberOfLines={1}>
                    {hero.mode === 'with'
                      ? 'With you now'
                      : hero.mode === 'waiting'
                        ? `Waiting${hero.item.checkedInAt ? ` ${elapsed(hero.item.checkedInAt, now)}` : ''}`
                        : `Next at ${formatSlot(hero.item.startAt, hero.item.timezone)}`}
                  </AppText>
                  <AppText variant="title" tone="onAccent" numberOfLines={1}>
                    {hero.item.patient.name}
                  </AppText>
                  <AppText variant="small" tone="onAccent" numberOfLines={1}>
                    {[hero.item.patient.age !== null ? `${hero.item.patient.age} y` : null, genderLabel(hero.item.patient.gender), hero.item.reason].filter(Boolean).join(' · ') || hero.item.locationName}
                  </AppText>
                </View>
                <IonIcon name="chevron-forward" size="md" color={service.onAccent} />
              </View>
              {nextStep(hero.item) ? (
                <Pressable
                  onPress={() => runStep(hero.item)}
                  disabled={s.busy === hero.item.id}
                  accessibilityRole="button"
                  accessibilityLabel={STEP_LABEL[nextStep(hero.item)!]}
                  style={({ pressed }) => [styles.heroButton, (pressed || s.busy === hero.item.id) && { opacity: opacity.pressed }]}>
                  <AppText variant="button" tone="accentDeep">
                    {s.busy === hero.item.id ? 'One moment…' : STEP_LABEL[nextStep(hero.item)!]}
                  </AppText>
                </Pressable>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <SectionHead title="Quick actions" />
            <QuickActionGrid actions={quick} columns={4} />
          </View>

          {/* The queue. */}
          <View style={styles.section}>
            <SectionHead title="Today's queue" />
            <SegmentTabs
              options={tabs.map(k => ({ key: k, label: queueTabLabel(k, t.counts) }))}
              value={s.queueTab}
              onChange={k => dispatch(setQueueTab(k))}
              accessibilityLabel="Today's queue"
            />
            {many ? (
              <View style={styles.chipsWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <ChoiceChip label="All locations" selected={!s.locationId} onPress={() => dispatch(setTodayLocation(null))} />
                  {t.locations.map(l => (
                    <ChoiceChip key={l.id} label={l.name} icon={l.kind === 'video' ? 'videocam-outline' : 'business-outline'} selected={s.locationId === l.id} onPress={() => dispatch(setTodayLocation(l.id))} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {s.stale ? (
              <View style={styles.stale} accessibilityLiveRegion="polite">
                <IonIcon name="cloud-offline-outline" size="sm" color={colors.inkMuted} />
                <AppText variant="caption" tone="muted">
                  Couldn’t refresh. Pull down to try again.
                </AppText>
              </View>
            ) : null}
            {shown.length ? (
              <View style={styles.list}>{shown.map(row)}</View>
            ) : (
              <EmptyState
                icon={s.queueTab === 'done' ? 'checkmark-done-outline' : 'calendar-outline'}
                title={s.queueTab === 'waiting' ? 'Nobody is waiting' : s.queueTab === 'upcoming' ? 'No more visits booked today' : 'Nobody seen yet today'}
                body={
                  s.queueTab === 'waiting'
                    ? 'Patients you check in, and walk-ins, wait here.'
                    : s.queueTab === 'upcoming'
                      ? 'New bookings appear here as patients make them.'
                      : 'Finished and missed visits move here.'
                }
                action={s.queueTab === 'upcoming' && !t.counts.total ? { label: 'See what patients see', onPress: () => go.navigate('Availability', { tab: 'preview' }) } : undefined}
              />
            )}
          </View>

          {/* What still needs you, any day. */}
          {needs.length ? (
            <View style={styles.section}>
              <SectionHead title="Needs you" />
              <Card padded="horizontal">
                {needs.map((n, i) => (
                  <React.Fragment key={n.key}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      title={n.title}
                      leftIcon={n.icon}
                      value={String(n.count)}
                      onPress={() => (n.key === 'review' ? go.navigate('MyReviews', { unreplied: true }) : go.navigate('DoctorNeeds', { kind: n.key }))}
                    />
                  </React.Fragment>
                ))}
              </Card>
            </View>
          ) : null}

          {/* The last 7 days. */}
          {week ? (
            <SectionCard title="Last 7 days" icon="bar-chart-outline" action={{ label: 'Insights', onPress: () => go.navigate('DoctorInsights') }}>
              <View style={styles.weekNumbers}>
                <View style={styles.weekNumber}>
                  <AppText variant="stat">{formatPKR(week.recordedFees)}</AppText>
                  <AppText variant="caption" tone="muted">
                    Recorded fees
                  </AppText>
                </View>
                <View style={styles.weekNumber}>
                  <AppText variant="stat">{weekVisits}</AppText>
                  <AppText variant="caption" tone="muted">
                    Visits
                  </AppText>
                </View>
              </View>
              {weekVisits ? (
                <BarChart data={week.perDay.map(p => ({ label: p.date.slice(8), value: p.video + p.clinic }))} height={size.chart.spark} />
              ) : null}
            </SectionCard>
          ) : null}

          {/* What patients say. */}
          {reviews && reviews.count > 0 ? (
            <RowCard
              title={`${reviews.average !== null ? reviews.average.toFixed(1) : '–'} from ${reviews.count} ${reviews.count === 1 ? 'review' : 'reviews'}`}
              mark={{ icon: 'star-outline' }}
              lines={[
                t.attention?.reviewsToReply
                  ? `${t.attention.reviewsToReply} waiting for your reply`
                  : reviews.recommendPct !== null
                    ? `${Math.round(reviews.recommendPct)}% would recommend you`
                    : 'Read and reply',
              ]}
              chevron
              onPress={() => go.navigate('MyReviews')}
            />
          ) : null}

          {/* How complete the profile is. */}
          {strength ? (
            <Card>
              <View style={styles.strengthHead}>
                <AppText variant="title">Profile strength</AppText>
                <AppText variant="bodyStrong" tone="accentDeep">{`${strength.percent}%`}</AppText>
              </View>
              <ProgressBar progress={strength.percent / 100} accessibilityLabel={`Profile ${strength.percent}% complete`} />
              {nextMissing ? (
                <AppText variant="small" tone="muted">
                  {nextMissing.detail ?? `Next: ${nextMissing.label.toLowerCase()}`}
                </AppText>
              ) : null}
              <Button label="Finish your profile" size="sm" variant="secondary" onPress={() => go.navigate('PracticeSetup')} />
            </Card>
          ) : null}
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
      <WalkInSheet />
    </ScreenShell>
  );
};

export default DoctorToday;
