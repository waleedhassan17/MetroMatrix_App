// ═══════════════════════════════════════════════════════
// MetroMatrix — Insights
// ═══════════════════════════════════════════════════════
// Appointments per day (video and clinic), how visits ended (completed,
// cancelled, missed), the measured average wait, your rating over time, and
// fees recorded from completed visits — MetroMatrix doesn't process them.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, BarChart, Card, InlineNotice, LineChart, ScreenShell, SegmentTabs, SkeletonLines } from '@custom/index';
import type { DoctorInsightsRange, DoctorPartnerStackParamList } from '@/types';
import { formatDayChip } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { loadInsightsAsync, selectDoctorInsights } from './doctorInsightsSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorInsights'>;

const RANGES: { key: DoctorInsightsRange; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

const makeStyles = ({ space, radius, colors }: Theme) =>
  StyleSheet.create({
    tiles: { flexDirection: 'row', gap: space.s8 },
    tile: { flex: 1, alignItems: 'center', gap: space.s0, paddingVertical: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

const DoctorInsightsScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorInsightsContent {...props} />
  </ServiceScope>
);

const DoctorInsightsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectDoctorInsights);
  const d = s.insights;

  useEffect(() => {
    void dispatch(loadInsightsAsync(s.range));
    // Load once; the range chips reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const perDay = (d?.perDay ?? []).map(p => ({ label: formatDayChip(p.date).day, value: p.video + p.clinic }));
  // Long ranges read better as weeks.
  const bars: { label: string; value: number }[] = [];
  if (perDay.length > 14) {
    perDay.forEach((p, i) => {
      if (i % 7 === 0) bars.push({ ...p });
      else bars[bars.length - 1].value += p.value;
    });
  } else bars.push(...perDay);

  return (
    <ScreenShell title="Insights" subtitle="From your appointments" onBack={back} refreshing={s.status === 'loading' && !!d} onRefresh={() => void dispatch(loadInsightsAsync(s.range))}>
      <SegmentTabs options={RANGES} value={s.range} onChange={r => void dispatch(loadInsightsAsync(r))} accessibilityLabel="Range" />
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {!d ? (
        <SkeletonLines lines={10} />
      ) : (
        <>
          <Card>
            <AppText variant="title">{`${d.appointments} appointments`}</AppText>
            <AppText variant="small" tone="muted">
              {`${d.perDay.reduce((n, p) => n + p.video, 0)} video · ${d.perDay.reduce((n, p) => n + p.clinic, 0)} clinic${perDay.length > 14 ? ' · per week' : ' · per day'}`}
            </AppText>
            <BarChart data={bars} />
          </Card>
          <View style={styles.tiles}>
            {[
              ['Completed', d.outcomes.completed],
              ['Cancelled', d.outcomes.cancelled],
              ['Missed', d.outcomes.noShow],
            ].map(([l, n]) => (
              <View key={l as string} style={styles.tile} accessible accessibilityLabel={`${l}: ${n}`}>
                <AppText variant="h2">{String(n)}</AppText>
                <AppText variant="caption" tone="muted">
                  {l as string}
                </AppText>
              </View>
            ))}
          </View>
          <Card>
            <AppText variant="title">Average wait</AppText>
            <AppText variant="h1">{d.avgWaitMinutes !== null ? `${d.avgWaitMinutes} min` : '—'}</AppText>
            <AppText variant="small" tone="muted">
              {d.avgWaitMinutes !== null ? 'From check-in to the start of the consultation, at your clinics.' : 'Shown once at least three checked-in visits are completed.'}
            </AppText>
          </Card>
          {d.ratingTrend.length > 1 ? (
            <Card>
              <AppText variant="title">Your rating</AppText>
              <LineChart data={d.ratingTrend.map(r => ({ label: formatDayChip(r.date).day, value: r.rating }))} format={n => n.toFixed(1)} />
            </Card>
          ) : null}
          <Card>
            <AppText variant="title">Recorded fees</AppText>
            <AppText variant="h1">{formatPKR(d.recordedFees)}</AppText>
            <AppText variant="small" tone="muted">
              Recorded from completed visits. MetroMatrix does not process your payments.
            </AppText>
          </Card>
        </>
      )}
    </ScreenShell>
  );
};

export default DoctorInsightsScreen;
