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
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, BarChart, Card, Divider, InlineNotice, LineChart, ScreenShell, SegmentTabs, SkeletonLines } from '@custom/index';
import type { InsightsRange, StorePartnerStackParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { formatPKR } from '@utils/money';
import { loadInsightsAsync, selectInsights, setInsightsRange } from './insightsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'Insights'>;

const RANGES: { key: InsightsRange; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '40%', gap: space.s4, padding: space.s16, borderRadius: radius.lg, borderWidth: size.hairline, borderColor: colors.line },
    product: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    thumb: { width: size.storeLogo, height: size.storeLogo, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    grow: { flex: 1, gap: space.s4 },
  });

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText variant="h2">{value}</AppText>
    </View>
  );
};

const InsightsScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <InsightsContent {...props} />
  </ServiceScope>
);

const InsightsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectInsights);
  const d = s.data?.range === s.range ? s.data : null;

  useEffect(() => {
    void dispatch(loadInsightsAsync(s.range));
  }, [dispatch, s.range]);

  const label = (iso: string) => dayjs(iso).format('D MMM');
  const avg = d && d.orderCount ? Math.round(d.recordedSales / d.orderCount) : 0;

  return (
    <ScreenShell title="Insights" onBack={back}>
      <SegmentTabs options={RANGES} value={s.range} onChange={r => dispatch(setInsightsRange(r))} accessibilityLabel="Range" />
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadInsightsAsync(s.range)) }} /> : null}
      {!d ? (
        <SkeletonLines lines={10} />
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile label="Recorded sales" value={formatPKR(d.recordedSales)} />
            <Tile label="Orders delivered" value={String(d.orderCount)} />
            <Tile label="Average order" value={formatPKR(avg)} />
            <Tile label="Repeat customers" value={`${d.repeatCustomerPct}%`} />
            <Tile label="Orders delivered, of placed" value={`${d.deliveredRatePct}%`} />
          </View>
          <Card>
            <AppText variant="title">Recorded sales</AppText>
            <LineChart data={d.sales.map(p => ({ label: label(p.date), value: p.amount }))} format={formatPKR} />
          </Card>
          <Card>
            <AppText variant="title">Orders delivered</AppText>
            <BarChart data={d.orders.map(p => ({ label: label(p.date), value: p.count }))} />
          </Card>
          <Card>
            <AppText variant="title">Best sellers</AppText>
            {d.topProducts.length ? (
              d.topProducts.map((p, i) => (
                <View key={p.productId}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.product}>
                    {p.imageUrl ? <Image source={{ uri: cdn(p.imageUrl, { w: size.storeLogo }) ?? undefined }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
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
              <AppText variant="body" tone="muted">
                Nothing delivered in this period yet.
              </AppText>
            )}
          </Card>
          <AppText variant="caption" tone="muted">
            Recorded sales are orders you marked delivered, at the price the customer paid. MetroMatrix does not hold or process your money.
          </AppText>
        </>
      )}
    </ScreenShell>
  );
};

export default InsightsScreen;
