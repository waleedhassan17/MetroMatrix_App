// ═══════════════════════════════════════════════════════
// MetroMatrix — Insights
// ═══════════════════════════════════════════════════════
// Recorded sales and delivered orders over 7, 30 or 90 days, the average
// order, repeat customers, how many orders reach delivery, and what sells.
// Only orders the store marked delivered count. These are records, not a
// ledger: MetroMatrix does not hold or process the store's money.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BarChart,
  Divider,
  EmptyState,
  InlineNotice,
  LineChart,
  RowCardsSkeleton,
  ScreenShell,
  SectionCard,
  SegmentTabs,
  StatGridSkeleton,
} from '../../Custom-Components/index';
import { StatGrid } from '../../Components/admin/AdminParts';
import type { InsightsRange, StorePartnerStackParamList } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatPKR } from '../../utils/money/money';
import { loadInsightsAsync, selectInsights, setInsightsRange } from './insightsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'Insights'>;

const RANGES: { key: InsightsRange; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    product: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    rank: { width: size.markSmall, height: size.markSmall, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    thumb: { width: size.storeLogo, height: size.storeLogo, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    grow: { flex: 1, gap: space.s4 },
  });

const Insights: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <InsightsContent {...props} />
  </ServiceScope>
);

const InsightsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, service } = useTheme();
  const s = useAppSelector(selectInsights);
  const d = s.data?.range === s.range ? s.data : null;

  useEffect(() => {
    void dispatch(loadInsightsAsync(s.range));
  }, [dispatch, s.range]);

  const label = (iso: string) => dayjs(iso).format('D MMM');
  const avg = d && d.orderCount ? Math.round(d.recordedSales / d.orderCount) : 0;

  return (
    <ScreenShell
      title="Insights"
      subtitle="From orders you marked delivered"
      onBack={back}
      headerContent={<SegmentTabs options={RANGES} value={s.range} onChange={r => dispatch(setInsightsRange(r))} accessibilityLabel="Range" />}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadInsightsAsync(s.range)) }} /> : null}
      {!d ? (
        <>
          <StatGridSkeleton count={4} />
          <RowCardsSkeleton count={2} />
        </>
      ) : (
        <>
          <StatGrid
            stats={[
              { key: 'sales', icon: 'cash-outline', tint: 'accent', value: formatPKR(d.recordedSales), label: 'Recorded sales' },
              {
                key: 'orders',
                icon: 'cube-outline',
                tint: 'blue',
                value: d.orderCount,
                label: 'Orders delivered',
                hint: `${d.deliveredRatePct}% of those placed`,
              },
              { key: 'avg', icon: 'receipt-outline', tint: 'violet', value: formatPKR(avg), label: 'Average order' },
              { key: 'repeat', icon: 'people-outline', tint: 'rose', value: `${d.repeatCustomerPct}%`, label: 'Repeat customers' },
            ]}
          />
          <SectionCard title="Recorded sales" icon="trending-up-outline">
            <LineChart data={d.sales.map(p => ({ label: label(p.date), value: p.amount }))} format={formatPKR} />
          </SectionCard>
          <SectionCard title="Orders delivered" icon="bar-chart-outline">
            <BarChart data={d.orders.map(p => ({ label: label(p.date), value: p.count }))} />
          </SectionCard>
          <SectionCard title="Best sellers" icon="trophy-outline">
            {d.topProducts.length ? (
              d.topProducts.map((p, i) => (
                <View key={p.productId}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.product}>
                    <View style={[styles.rank, { backgroundColor: service.accentSoft }]}>
                      <AppText variant="chip" tone="accentDeep">
                        {i + 1}
                      </AppText>
                    </View>
                    {p.imageUrl ? (
                      <Image source={{ uri: cdn(p.imageUrl, { w: size.storeLogo * 2 }) ?? undefined }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={styles.thumb} />
                    )}
                    <View style={styles.grow}>
                      <AppText variant="small" numberOfLines={1}>
                        {p.name}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {p.units} sold
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong">{formatPKR(p.amount)}</AppText>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState ion="trophy-outline" title="Nothing delivered yet" body="Your best sellers show here once orders are delivered." />
            )}
          </SectionCard>
          <AppText variant="caption" tone="muted">
            Recorded sales are orders you marked delivered, at the price the customer paid. MetroMatrix does not hold or process your money.
          </AppText>
        </>
      )}
    </ScreenShell>
  );
};

export default Insights;
