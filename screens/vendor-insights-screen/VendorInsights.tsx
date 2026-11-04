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
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { INSIGHT_RANGES, answerTimeLabel, cancelReasonText, isQuiet, minutesLabel, percentLabel } from '../../models/food/insightsModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, BarChart, Divider, EmptyState, InlineNotice, ScreenShell, SectionCard, SegmentTabs, StatGridSkeleton } from '../../Custom-Components/index';
import { StatGrid } from '../../Components/admin/AdminParts';
import type { FoodVendorStackParamList } from '../../models';
import { formatPKR } from '../../utils/money/money';
import { loadFoodInsightsAsync, selectVendorInsights, setFoodInsightsRange } from './vendorInsightsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorInsights'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
  });

const VendorInsights: React.FC<Props> = props => (
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
    <ScreenShell
      title="Insights"
      subtitle="Recorded sales and how the kitchen runs"
      onBack={back}
      refreshing={s.status === 'loading' && !!d}
      onRefresh={() => void dispatch(loadFoodInsightsAsync(s.range))}
      headerContent={<SegmentTabs options={INSIGHT_RANGES} value={s.range} onChange={r => dispatch(setFoodInsightsRange(r))} accessibilityLabel="Range" />}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodInsightsAsync(s.range)) }} /> : null}
      {!d ? (
        s.error.message ? null : <StatGridSkeleton count={4} />
      ) : isQuiet(d) ? (
        // A quiet period: just the empty state, never a page of zeros.
        <EmptyState ion="bar-chart-outline" title="No orders in this period" body="Your numbers show here once customers order." />
      ) : (
        <>
          <StatGrid
            stats={[
              { key: 'sales', icon: 'cash-outline', tint: 'green', value: formatPKR(d.totals.recordedSales), label: 'Recorded sales' },
              { key: 'done', icon: 'checkmark-done-outline', tint: 'blue', value: d.totals.completed, label: 'Orders completed', hint: `of ${d.totals.orders} placed` },
              { key: 'avg', icon: 'receipt-outline', tint: 'violet', value: formatPKR(d.totals.averageOrderValue), label: 'Average order' },
              { key: 'accepted', icon: 'thumbs-up-outline', tint: 'teal', value: percentLabel(d.acceptanceRate), label: 'Accepted', hint: d.autoRejected ? `${d.autoRejected} not answered in time` : null },
              { key: 'answer', icon: 'timer-outline', tint: 'amber', value: answerTimeLabel(d.avgAcceptSeconds), label: 'Time to answer' },
              { key: 'prep', icon: 'flame-outline', tint: 'red', value: minutesLabel(d.avgPrepMinutes), label: 'Prep time' },
              { key: 'ontime', icon: 'alarm-outline', tint: 'green', value: percentLabel(d.onTimeRate), label: 'On time' },
              { key: 'back', icon: 'repeat-outline', tint: 'violet', value: percentLabel(d.repeatCustomers.rate), label: 'Came back', hint: `${d.repeatCustomers.repeat} of ${d.repeatCustomers.customers} customers` },
            ]}
          />
          {isQuiet(d) ? null : (
            <>
              {d.days.length > 1 ? (
                <>
                  <SectionCard title="Recorded sales" icon="cash-outline">
                    <BarChart data={d.days.map(x => ({ label: day(x.date), value: x.recordedSales }))} format={formatPKR} />
                  </SectionCard>
                  <SectionCard title="Orders" icon="receipt-outline">
                    <BarChart data={d.days.map(x => ({ label: day(x.date), value: x.orders }))} />
                  </SectionCard>
                </>
              ) : null}
              <SectionCard title="What sells" icon="trophy-outline">
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
              </SectionCard>
              {d.cancelReasons.length ? (
                <SectionCard title="Why orders ended" icon="close-circle-outline">
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
                </SectionCard>
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

export default VendorInsights;
