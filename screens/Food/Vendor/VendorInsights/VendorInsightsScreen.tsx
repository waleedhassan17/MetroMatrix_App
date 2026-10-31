// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: insights
// ═══════════════════════════════════════════════════════
// Today, 7 or 30 days in the kitchen's own days: orders and recorded
// sales (orders marked delivered or collected; customers paid the kitchen
// directly, MetroMatrix holds none of it), how fast new orders are
// answered, prep time, on-time delivery, the dishes that sell, why orders
// ended, and customers who came back.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { INSIGHT_RANGES, answerTimeLabel, cancelReasonText, isQuiet, minutesLabel, percentLabel } from '../../../../models/food/insightsModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, BarChart, Card, Divider, EmptyState, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines } from '../../../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../../../types';
import { formatPKR } from '../../../../utils/money';
import { loadFoodInsightsAsync, selectVendorInsights, setFoodInsightsRange } from './vendorInsightsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorInsights'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '40%', gap: space.s4, padding: space.s16, borderRadius: radius.lg, borderWidth: size.hairline, borderColor: colors.line },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
  });

const Tile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText variant="h2">{value}</AppText>
      {hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
};

const VendorInsightsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorInsightsContent {...props} />
  </ServiceScope>
);

const VendorInsightsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorInsights);
  const d = s.byRange[s.range] ?? null;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFoodInsightsAsync(s.range));
    }, [dispatch, s.range]),
  );

  const day = (iso: string) => (s.range === '30d' ? dayjs(iso).format('D MMM') : dayjs(iso).format('ddd'));

  return (
    <ScreenShell title="Insights" onBack={back} refreshing={s.status === 'loading' && !!d} onRefresh={() => void dispatch(loadFoodInsightsAsync(s.range))}>
      <SegmentTabs options={INSIGHT_RANGES} value={s.range} onChange={r => dispatch(setFoodInsightsRange(r))} accessibilityLabel="Range" />
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodInsightsAsync(s.range)) }} /> : null}
      {!d ? (
        s.error.message ? null : <SkeletonLines lines={10} />
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile label="Recorded sales" value={formatPKR(d.totals.recordedSales)} />
            <Tile label="Orders completed" value={String(d.totals.completed)} hint={`of ${d.totals.orders} placed`} />
            <Tile label="Average order" value={formatPKR(d.totals.averageOrderValue)} />
            <Tile label="Accepted" value={percentLabel(d.acceptanceRate)} hint={d.autoRejected ? `${d.autoRejected} not answered in time` : undefined} />
            <Tile label="Time to answer" value={answerTimeLabel(d.avgAcceptSeconds)} />
            <Tile label="Prep time" value={minutesLabel(d.avgPrepMinutes)} />
            <Tile label="On time" value={percentLabel(d.onTimeRate)} />
            <Tile label="Came back" value={percentLabel(d.repeatCustomers.rate)} hint={`${d.repeatCustomers.repeat} of ${d.repeatCustomers.customers} customers`} />
          </View>
          {isQuiet(d) ? (
            <EmptyState icon="bar-chart-2" title="No orders in this period" body="Your numbers show here once customers order." />
          ) : (
            <>
              {d.days.length > 1 ? (
                <>
                  <Card>
                    <AppText variant="title">Recorded sales</AppText>
                    <BarChart data={d.days.map(x => ({ label: day(x.date), value: x.recordedSales }))} format={formatPKR} />
                  </Card>
                  <Card>
                    <AppText variant="title">Orders</AppText>
                    <BarChart data={d.days.map(x => ({ label: day(x.date), value: x.orders }))} />
                  </Card>
                </>
              ) : null}
              <Card>
                <AppText variant="title">What sells</AppText>
                {d.topItems.length ? (
                  d.topItems.map((it, i) => (
                    <View key={it.name}>
                      {i > 0 ? <Divider /> : null}
                      <View style={styles.row}>
                        <View style={styles.grow}>
                          <AppText variant="body" numberOfLines={1}>
                            {it.name}
                          </AppText>
                          <AppText variant="caption" tone="muted">
                            {`${it.quantity} sold`}
                          </AppText>
                        </View>
                        <AppText variant="bodyStrong">{formatPKR(it.recordedSales)}</AppText>
                      </View>
                    </View>
                  ))
                ) : (
                  <AppText variant="body" tone="muted">
                    Nothing completed in this period yet.
                  </AppText>
                )}
              </Card>
              {d.cancelReasons.length ? (
                <Card>
                  <AppText variant="title">Why orders ended</AppText>
                  {d.cancelReasons.map((c, i) => (
                    <View key={`${c.status}-${c.reason}`}>
                      {i > 0 ? <Divider /> : null}
                      <View style={styles.row}>
                        <AppText variant="body" style={styles.grow}>
                          {cancelReasonText(c)}
                        </AppText>
                        <AppText variant="bodyStrong">{c.count}</AppText>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          )}
          <AppText variant="caption" tone="muted">
            {d.note ?? 'Recorded sales are the orders you marked delivered or collected. You received this money directly — MetroMatrix holds none of it.'}
          </AppText>
        </>
      )}
    </ScreenShell>
  );
};

export default VendorInsightsScreen;
