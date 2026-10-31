// ═══════════════════════════════════════════════════════
// MetroMatrix — Booking confirmed
// ═══════════════════════════════════════════════════════
// "Appointment confirmed" (or, for a prepaid video, what to send and by
// when), the code to quote, when and where — with Directions and Call for a
// clinic, or how to join a video consult — and Add to calendar. Reads the
// appointment the booking already returned (Appointment detail slice).

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, IonIcon, InlineNotice, PaymentInstructionsCard, ScreenShell, SkeletonLines, TextAction } from '../../../../Custom-Components/index';
import { KIND_LABEL } from '../../../../models/health/appointmentStatusModel';
import type { HomeStackParamList } from '../../../../types';
import { formatLongDate, formatTimeRange, relativeStart } from '../../../../utils/healthTime';
import { formatPKR } from '../../../../utils/money';
import { callNumber, openDirections } from '../../../../utils/maps';
import { addToCalendar, isCalendarSupported, type CalendarResult } from '../../../../services/calendar';
import { loadAppointmentAsync, selectAppointmentEntry } from '../AppointmentDetail/appointmentDetailSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'BookingConfirmed'>;

const makeStyles = ({ space, radius, size }: Theme) =>
  StyleSheet.create({
    top: { alignItems: 'center', gap: space.s8, paddingTop: space.s8 },
    check: { width: size.icon.hero + space.s24, height: size.icon.hero + space.s24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    code: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    line: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    lineText: { flex: 1, gap: space.s4 },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16 },
    actions: { gap: space.s12 },
  });

const BookingConfirmedScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <BookingConfirmedContent {...props} />
  </ServiceScope>
);

const BookingConfirmedContent: React.FC<Props> = ({ route, navigation }) => {
  const { code } = route.params;
  const { back } = useBack({ name: 'AppointmentDetail', params: { code } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const entry = useAppSelector(st => selectAppointmentEntry(st, code));
  const a = entry.appointment;
  const [calendar, setCalendar] = useState<CalendarResult | 'adding' | null>(null);

  useEffect(() => {
    if (!a && entry.status === 'idle') void dispatch(loadAppointmentAsync(code));
  }, [a, entry.status, code, dispatch]);

  // Done: back to the Health tabs, on Appointments, where the new visit is.
  const done = () => (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate('HealthTabs', { screen: 'AppointmentsTab' });

  if (!a) {
    return (
      <ScreenShell title="Appointment" onBack={back}>
        {entry.status === 'failed' ? <InlineNotice message={entry.error.message} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const owed = a.payment.method === 'transfer' && a.status === 'awaiting_payment';
  const video = a.kind === 'video';

  const copyCode = async () => {
    await Clipboard.setStringAsync(a.code);
    Toast.show({ type: 'success', text1: 'Code copied' });
  };

  const addEvent = async () => {
    setCalendar('adding');
    const r = await addToCalendar({
      title: `${KIND_LABEL[a.kind]} with ${a.doctor.name}`,
      startAt: a.startAt,
      endAt: a.endAt,
      timezone: a.timezone,
      location: video ? 'Video consultation (MetroMatrix app)' : [a.location.name, a.location.address].filter(Boolean).join(', '),
      notes: `Appointment ${a.code} for ${a.patient.name}.${video ? ' Join from Appointments in MetroMatrix 10 minutes before.' : ''}`,
    });
    setCalendar(r);
    if (r === 'added') Toast.show({ type: 'success', text1: 'Added to your calendar', text2: 'With a reminder an hour before.' });
  };

  return (
    <ScreenShell
      title={owed ? 'Almost done' : 'Appointment confirmed'}
      subtitle={`${a.doctor.name} · ${a.doctor.specialty.name}`}
      onBack={back}
      footer={<Button label="Done" onPress={done} fullWidth />}>
      <View style={styles.top}>
        <View style={[styles.check, { backgroundColor: service.accentSoft }]}>
          <IonIcon name={owed ? 'time-outline' : 'checkmark-circle'} size="hero" color={service.accentDeep} />
        </View>
        <AppText variant="h1" align="center" accessibilityRole="header">
          {owed ? 'Send the fee to confirm' : 'Your appointment is confirmed'}
        </AppText>
        <View style={styles.code}>
          <AppText variant="body" tone="muted">
            Code
          </AppText>
          <AppText variant="bodyStrong" selectable>
            {a.code}
          </AppText>
          <TextAction label="Copy" icon="copy-outline" onPress={() => void copyCode()} accessibilityLabel={`Copy code ${a.code}`} />
        </View>
      </View>

      <Card>
        <View style={styles.line}>
          <IonIcon name="calendar-outline" size="lg" color={service.accentDeep} />
          <View style={styles.lineText}>
            <AppText variant="title">{formatLongDate(a.startAt, a.timezone)}</AppText>
            <AppText variant="body">{formatTimeRange(a.startAt, a.endAt, a.timezone)}</AppText>
            <AppText variant="small" tone="muted">
              {[relativeStart(a.startAt, undefined, a.endAt), `For ${a.patient.name}`, `Fee ${formatPKR(a.fee)}`].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.line}>
          <IonIcon name={video ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
          <View style={styles.lineText}>
            <AppText variant="title">{video ? 'Video consultation' : a.location.name}</AppText>
            {video ? (
              <AppText variant="body">Join from Appointments 10 minutes before your time. Use a quiet place with good signal, and keep your reports nearby.</AppText>
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
      </Card>

      {owed && a.payment.instructions ? (
        <PaymentInstructionsCard
          instructions={a.payment.instructions}
          status={a.payment.status}
          proof={a.payment.proof}
          payee="doctor"
          onPaid={() => navigation.navigate('PaymentProof', { appointmentCode: a.code })}
        />
      ) : null}

      <View style={styles.actions}>
        {isCalendarSupported() ? (
          <Button
            label={calendar === 'added' ? 'Added to your calendar' : 'Add to calendar'}
            variant="secondary"
            leftIcon="calendar-number-outline"
            onPress={() => void addEvent()}
            loading={calendar === 'adding'}
            disabled={calendar === 'added'}
            fullWidth
          />
        ) : null}
        {calendar === 'denied' ? (
          <InlineNotice tone="info" message="MetroMatrix can't add it without calendar access. You can allow it in your phone's settings, or note the time above." />
        ) : calendar === 'unavailable' ? (
          <InlineNotice tone="info" message="No calendar on this phone accepts new events. Note the time above." />
        ) : null}
        <Button label="View appointment" variant="ghost" onPress={() => navigation.navigate('AppointmentDetail', { code: a.code })} fullWidth />
      </View>
    </ScreenShell>
  );
};

export default BookingConfirmedScreen;
