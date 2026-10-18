// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Health
// ═══════════════════════════════════════════════════════
// Health at a glance (listed doctors, today's bookings, cancellations and
// no-shows, doctors waiting for a PMDC check), doctors by specialty, and the
// staff tools: verification first (it holds up approvals), then reviews,
// specialties, conditions and appointment lookup.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Card, InlineNotice, ProgressBar, ScreenShell } from '@custom/index';
import { SectionHead, StatGrid, ToolSection, type AdminStat } from '@components/admin/AdminParts';
import type { AdminHealthStackParamList } from '@/types';
import { loadHealthOverviewAsync, selectHealthOverview } from './healthOverviewSlice';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'HealthOverview'>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s8 },
    bar: { gap: space.s4, paddingVertical: space.s4 },
    barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s8 },
  });

const HealthOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectHealthOverview);
  const o = s.overview;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadHealthOverviewAsync());
    }, [dispatch]),
  );

  const stats: AdminStat[] = [
    { key: 'doctors', icon: 'medkit-outline', tint: 'blue', value: o?.listedDoctors ?? null, label: 'Listed doctors', hint: 'Patients can book' },
    { key: 'bookings', icon: 'calendar-outline', tint: 'accent', value: o?.bookingsToday ?? null, label: 'Bookings today', hint: 'Since midnight', onPress: () => navigation.navigate('AppointmentLookup') },
    { key: 'cancelled', icon: 'close-circle-outline', tint: 'grey', value: o?.cancelledToday ?? null, label: 'Cancelled today', hint: 'By patients or doctors' },
    { key: 'noshows', icon: 'person-remove-outline', tint: 'amber', value: o?.noShowsToday ?? null, label: 'No-shows today', hint: 'Marked by the doctor' },
  ];
  const top = o?.bySpecialty.slice(0, 8) ?? [];
  const most = Math.max(1, ...top.map(x => x.count));

  return (
    <ScreenShell eyebrow="Admin" title="Health" subtitle="Doctors, bookings and what patients say" refreshing={s.status === 'loading' && !!o} onRefresh={() => void dispatch(loadHealthOverviewAsync())}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadHealthOverviewAsync()) }} /> : null}
      <StatGrid stats={stats} />
      {o?.pendingVerification ? (
        <ToolSection
          title="Needs you"
          tools={[
            {
              key: 'pmdc',
              title: `${plural(o.pendingVerification, 'doctor')} to check`,
              subtitle: 'The PMDC number, before approval',
              icon: 'shield-checkmark-outline',
              tint: 'amber',
              onPress: () => navigation.navigate('DoctorVerification'),
            },
          ]}
        />
      ) : null}
      <ToolSection
        title="Manage"
        tools={[
          {
            key: 'verify',
            title: 'Doctor verification',
            subtitle: o?.pendingVerification ? `${o.pendingVerification} waiting for a PMDC check` : 'Nothing waiting',
            icon: 'shield-checkmark-outline',
            tint: 'blue',
            onPress: () => navigation.navigate('DoctorVerification'),
          },
          { key: 'reviews', title: 'Reviews', subtitle: 'Hide a review that breaks the rules', icon: 'chatbox-ellipses-outline', tint: 'rose', onPress: () => navigation.navigate('ReviewModeration') },
          { key: 'specialties', title: 'Specialties', subtitle: 'What patients browse, and in what order', icon: 'grid-outline', tint: 'violet', onPress: () => navigation.navigate('Specialties') },
          { key: 'conditions', title: 'Conditions', subtitle: 'Search words and the specialty each leads to', icon: 'list-outline', tint: 'amber', onPress: () => navigation.navigate('Conditions') },
          { key: 'lookup', title: 'Find an appointment', subtitle: 'By its HC- code', icon: 'search-outline', tint: 'grey', onPress: () => navigation.navigate('AppointmentLookup') },
        ]}
      />
      {top.length ? (
        <View style={styles.section}>
          <SectionHead title="Listed doctors by specialty" />
          <Card>
            {top.map(x => (
              <View key={x.name} style={styles.bar}>
                <View style={styles.barHead}>
                  <AppText variant="body">{x.name}</AppText>
                  <AppText variant="bodyStrong">{x.count}</AppText>
                </View>
                <ProgressBar progress={x.count / most} accessibilityLabel={`${x.name}: ${x.count} doctors`} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </ScreenShell>
  );
};

export default HealthOverviewScreen;
