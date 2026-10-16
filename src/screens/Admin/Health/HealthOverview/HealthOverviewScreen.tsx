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
import { AppText, Card, Divider, InlineNotice, ListRow, ProgressBar, ScreenShell, SkeletonLines } from '@custom/index';
import type { AdminHealthStackParamList } from '@/types';
import { loadHealthOverviewAsync, selectHealthOverview } from './healthOverviewSlice';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'HealthOverview'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '40%', padding: space.s16, gap: space.s4, borderRadius: radius.lg, borderWidth: size.hairline, borderColor: colors.line },
    bar: { gap: space.s4, paddingVertical: space.s8 },
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

  const tiles: [string, number | undefined][] = [
    ['Listed doctors', o?.listedDoctors],
    ['Bookings today', o?.bookingsToday],
    ['Cancelled today', o?.cancelledToday],
    ['No-shows today', o?.noShowsToday],
  ];
  const top = o?.bySpecialty.slice(0, 8) ?? [];
  const most = Math.max(1, ...top.map(x => x.count));

  return (
    <ScreenShell eyebrow="Admin" title="Health">
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadHealthOverviewAsync()) }} /> : null}
      {o?.pendingVerification ? (
        <InlineNotice
          tone="warning"
          title={`${o.pendingVerification} ${o.pendingVerification === 1 ? 'doctor needs' : 'doctors need'} a PMDC check`}
          message="They can't be approved until the registration is checked."
          action={{ label: 'Check now', onPress: () => navigation.navigate('DoctorVerification') }}
        />
      ) : null}
      {!o ? (
        <SkeletonLines lines={4} />
      ) : (
        <View style={styles.grid}>
          {tiles.map(([label, n]) => (
            <View key={label} style={styles.tile} accessible accessibilityLabel={`${label}: ${n ?? 0}`}>
              <AppText variant="h1">{n ?? 0}</AppText>
              <AppText variant="small" tone="muted">
                {label}
              </AppText>
            </View>
          ))}
        </View>
      )}
      <Card padded="horizontal">
        <ListRow
          title="Doctor verification"
          subtitle={o?.pendingVerification ? `${o.pendingVerification} waiting for a PMDC check` : 'Nothing waiting'}
          leftIcon="shield-checkmark-outline"
          onPress={() => navigation.navigate('DoctorVerification')}
        />
        <Divider />
        <ListRow title="Reviews" subtitle="Hide a review that breaks the rules" leftIcon="chatbox-ellipses-outline" onPress={() => navigation.navigate('ReviewModeration')} />
        <Divider />
        <ListRow title="Specialties" subtitle="What patients browse, in English and Urdu" leftIcon="grid-outline" onPress={() => navigation.navigate('Specialties')} />
        <Divider />
        <ListRow title="Conditions" subtitle="Search words and the specialty each leads to" leftIcon="list-outline" onPress={() => navigation.navigate('Conditions')} />
        <Divider />
        <ListRow title="Find an appointment" subtitle="By its HC- code" leftIcon="search-outline" onPress={() => navigation.navigate('AppointmentLookup')} />
      </Card>
      {top.length ? (
        <Card>
          <AppText variant="title">Listed doctors by specialty</AppText>
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
      ) : null}
    </ScreenShell>
  );
};

export default HealthOverviewScreen;
