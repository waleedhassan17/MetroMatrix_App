// ═══════════════════════════════════════════════════════
// MetroMatrix — Insights
// ═══════════════════════════════════════════════════════
// All from GET /health/doctor/insights: visits per day (video and clinic,
// cancelled ones left out), how visits ended with their rates, new and
// returning patients, the measured wait and time with each patient, your
// rating over time, and the fees you recorded (at the clinic, by transfer,
// refunds) — MetroMatrix never processes or holds them.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  BarChart,
  InlineNotice,
  LineChart,
  MoneyRows,
  RowCardsSkeleton,
  ScreenShell,
  SectionCard,
  SegmentTabs,
  StatGridSkeleton,
} from '../../Custom-Components/index';
import { StatGrid } from '../../Components/admin/AdminParts';
import type { DoctorInsights as Insights, DoctorInsightsRange, DoctorPartnerStackParamList } from '../../models';
import { formatDayChip } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { loadInsightsAsync, selectDoctorInsights } from './doctorInsightsSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorInsights'>;

const RANGES: { key: DoctorInsightsRange; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    pair: { flexDirection: 'row', gap: space.s16 },
    half: { flex: 1, gap: space.s0 },
  });

/** 0.455 → "46%"; nothing ended yet → null. */
const pct = (r: number | null) => (r === null ? null : `${Math.round(r * 100)}%`);
const visits = (n: number) => (n === 1 ? '1 visit' : `${n} visits`);
const minutes = (n: number | null) => (n === null ? '—' : `${n} min`);

const DoctorInsights: React.FC<Props> = props => (
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
  const reload = () => void dispatch(loadInsightsAsync(s.range));

  useEffect(() => {
    void dispatch(loadInsightsAsync(s.range));
    // Load once; the range chips reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <ScreenShell
      title="Insights"
      subtitle="From your appointments"
      onBack={back}
      refreshing={s.status === 'loading' && !!d}
      onRefresh={reload}
      headerContent={<SegmentTabs options={RANGES} value={s.range} onChange={r => void dispatch(loadInsightsAsync(r))} accessibilityLabel="Range" />}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: reload }} /> : null}
      {!d ? (
        s.status === 'failed' ? null : (
          <>
            <StatGridSkeleton count={4} />
            <RowCardsSkeleton count={3} />
          </>
        )
      ) : (
        <InsightsBody d={d} styles={styles} />
      )}
    </ScreenShell>
  );
};

const InsightsBody: React.FC<{ d: Insights; styles: ReturnType<typeof makeStyles> }> = ({ d, styles }) => {
  const perDay = d.perDay.map(p => ({ label: formatDayChip(p.date).day, value: p.video + p.clinic }));
  // Long ranges read better as weeks.
  const bars: { label: string; value: number }[] = [];
  if (perDay.length > 14) {
    perDay.forEach((p, i) => {
      if (i % 7 === 0) bars.push({ ...p });
      else bars[bars.length - 1].value += p.value;
    });
  } else bars.push(...perDay);
  const video = d.perDay.reduce((n, p) => n + p.video, 0);
  const clinic = d.perDay.reduce((n, p) => n + p.clinic, 0);
  const o = d.outcomes;
  const seen = d.patients.new + d.patients.returning;

  return (
    <>
      <StatGrid
        columns={2}
        compact
        stats={[
          { key: 'done', icon: 'checkmark-done-outline', tint: 'green', value: o.completed, label: 'Completed', hint: pct(d.rates.completion) ? `${pct(d.rates.completion)} of visits that ended` : null },
          { key: 'cancelled', icon: 'close-circle-outline', tint: 'red', value: o.cancelled, label: 'Cancelled', hint: o.cancelled ? [pct(d.rates.cancellation), o.lateCancelled ? `${o.lateCancelled} late` : null, o.cancelledByDoctor ? `${o.cancelledByDoctor} by you` : null].filter(Boolean).join(' · ') : null },
          { key: 'missed', icon: 'alert-circle-outline', tint: 'amber', value: o.noShow, label: 'Missed', hint: o.noShow ? pct(d.rates.noShow) : null },
          { key: 'upcoming', icon: 'calendar-outline', tint: 'blue', value: o.upcoming, label: 'Still ahead', hint: 'Booked, not yet seen' },
        ]}
      />

      <SectionCard title="Visits" icon="bar-chart-outline">
        <AppText variant="small" tone="muted">
          {`${video} video · ${clinic} clinic · ${perDay.length > 14 ? 'per week' : 'per day'}, cancelled visits left out`}
        </AppText>
        <BarChart data={bars} />
      </SectionCard>

      <SectionCard title="Patients" icon="people-outline">
        {seen ? (
          <View style={styles.pair}>
            <View style={styles.half} accessible accessibilityLabel={`New patients: ${d.patients.new}`}>
              <AppText variant="h2">{String(d.patients.new)}</AppText>
              <AppText variant="small" tone="muted">
                First visit with you
              </AppText>
            </View>
            <View style={styles.half} accessible accessibilityLabel={`Returning patients: ${d.patients.returning}`}>
              <AppText variant="h2">{String(d.patients.returning)}</AppText>
              <AppText variant="small" tone="muted">
                Came back to you
              </AppText>
            </View>
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            The people you see in this period are counted here once their visits are completed.
          </AppText>
        )}
      </SectionCard>

      <SectionCard title="Time" icon="time-outline">
        <View style={styles.pair}>
          <View style={styles.half} accessible accessibilityLabel={`Average wait: ${minutes(d.avgWaitMinutes)}`}>
            <AppText variant="h2">{minutes(d.avgWaitMinutes)}</AppText>
            <AppText variant="small" tone="muted">
              Average wait
            </AppText>
          </View>
          <View style={styles.half} accessible accessibilityLabel={`Average time with a patient: ${minutes(d.avgConsultMinutes)}`}>
            <AppText variant="h2">{minutes(d.avgConsultMinutes)}</AppText>
            <AppText variant="small" tone="muted">
              With each patient
            </AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          {d.waitSamples || d.consultSamples
            ? `Measured from ${visits(Math.max(d.waitSamples, d.consultSamples))}: the wait runs from check-in (or the booked time) to the start, the time with a patient from start to complete.`
            : 'Measured once you start and complete visits in the app.'}
        </AppText>
      </SectionCard>

      {d.ratingTrend.length > 1 ? (
        <SectionCard title="Your rating" icon="star-outline">
          <LineChart data={d.ratingTrend.map(r => ({ label: formatDayChip(r.date).day, value: r.rating }))} format={n => n.toFixed(1)} />
        </SectionCard>
      ) : null}

      <SectionCard title="Recorded fees" icon="wallet-outline">
        <AppText variant="h1">{formatPKR(d.recordedFees)}</AppText>
        <MoneyRows
          rows={[
            { label: 'Paid at the clinic', value: d.fees.atClinic },
            { label: 'Paid by transfer', value: d.fees.byTransfer },
            d.fees.refundDue ? { label: 'Refunds you owe', value: d.fees.refundDue } : null,
            d.fees.refunded ? { label: 'Refunded', value: d.fees.refunded } : null,
          ]}
        />
        <AppText variant="small" tone="muted">
          The fees you marked as paid. MetroMatrix does not process or hold your payments.
        </AppText>
      </SectionCard>
    </>
  );
};

export default DoctorInsights;
