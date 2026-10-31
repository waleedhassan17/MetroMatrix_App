// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: tiffin
// ═══════════════════════════════════════════════════════
// The kitchen's tiffin plans (what each costs, how full it is), its
// subscribers at a glance (requests to answer, receipts to check), and
// tomorrow's tiffins per plan: how many to cook, what, for whom. At each
// day's cut-off the tiffins appear on the board as scheduled orders.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { cutoffLabel, perMealLabel, priceLabel, scheduleLabel } from '../../../../models/kitchen/tiffinModel';
import { MEAL_LABEL } from '../../../../models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { RowCard, SectionHead, StatGrid } from '../../../../Components/admin/AdminParts';
import type { FoodVendorStackParamList } from '../../../../types';
import { formatDayShort } from '../../../../utils/healthTime';
import { loadTiffinPlansAsync, selectTiffinPlans } from './tiffinPlansSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthTiffin'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, minWidth: 0 },
  });

const TiffinPlansScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <TiffinPlansContent {...props} />
  </ServiceScope>
);

const TiffinPlansContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectTiffinPlans);
  const load = useCallback(() => void dispatch(loadTiffinPlansAsync()), [dispatch]);
  useFocusEffect(load);

  const c = s.counts;
  const t = s.tomorrow;
  const tomorrowCount = t?.plans.reduce((n, p) => n + p.count, 0) ?? 0;

  return (
    <ScreenShell
      title="Tiffin"
      subtitle={c ? `${c.active} active · ${c.pending} to approve` : 'Plans people pay for by the week or month'}
      onBack={back}
      refreshing={s.status === 'loading' && !!c}
      onRefresh={load}
      footer={<Button label="New plan" leftIcon="add" onPress={() => navigation.navigate('GrowthTiffinPlanForm')} fullWidth />}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      <StatGrid
        stats={[
          { key: 'pending', icon: 'person-add-outline', tint: 'amber', value: c ? c.pending : null, label: 'To approve', onPress: () => navigation.navigate('GrowthTiffinSubscribers', { status: 'pending' }) },
          { key: 'active', icon: 'people-outline', tint: 'blue', value: c ? c.active : null, label: 'Subscribers', hint: c?.paused ? `${c.paused} paused` : null, onPress: () => navigation.navigate('GrowthTiffinSubscribers', { status: 'active' }) },
          { key: 'tomorrow', icon: 'calendar-outline', tint: 'violet', value: t ? tomorrowCount : null, label: 'Tomorrow', hint: t ? formatDayShort(t.date) : null },
          { key: 'receipts', icon: 'receipt-outline', tint: 'rose', value: c ? c.toCheck : null, label: 'Receipts to check', onPress: () => navigation.navigate('GrowthTiffinSubscribers', { status: 'active' }) },
        ]}
      />

      <SectionHead title="Plans" />
      {!s.plans.length && s.status === 'loading' ? <SkeletonLines lines={4} /> : null}
      {!s.plans.length && s.status === 'succeeded' ? (
        <EmptyState icon="package" title="No tiffin plans yet" body="Offer the same meal on set days, paid by the week or month: office lunches, home dinners, a breakfast box." />
      ) : null}
      {s.plans.map(p => (
        <RowCard
          key={p.id}
          title={p.name}
          mark={{ icon: p.meal === 'breakfast' ? 'cafe-outline' : p.meal === 'lunch' ? 'sunny-outline' : 'moon-outline', tint: 'amber' }}
          lines={[`${scheduleLabel(p)} · ${p.window.label}`, `${priceLabel(p)} · ${perMealLabel(p)}`, `${p.subscribers} of ${p.capacity} places taken`]}
          pill={!p.isActive ? { label: 'Not taking new', tone: 'neutral' } : p.seatsLeft ? { label: `${p.seatsLeft} left`, tone: 'success' } : { label: 'Full', tone: 'warning' }}
          onPress={() => navigation.navigate('GrowthTiffinSubscribers', { planId: p.id })}
        />
      ))}

      {t && t.plans.length ? (
        <>
          <SectionHead title={`Tomorrow, ${formatDayShort(t.date)}`} />
          {t.plans.map(p => (
            <Card key={p.planId}>
              <View style={styles.gap}>
                <View style={styles.row}>
                  <AppText variant="title" style={styles.grow}>
                    {`${MEAL_LABEL[p.meal]}: ${p.count} to cook`}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {p.window}
                  </AppText>
                </View>
                <AppText variant="body">{p.dishes.join(', ') || p.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {[p.name, p.skipped ? `${p.skipped} skipped` : null, p.paused ? `${p.paused} paused` : null, cutoffLabel(p.cutoffAt, TZ)].filter(Boolean).join(' · ')}
                </AppText>
                {p.deliveries.length ? <Divider /> : null}
                {p.deliveries.map(d => (
                  <View key={d.code} style={styles.row}>
                    <AppText variant="small" style={styles.grow} numberOfLines={1}>
                      {[d.customerName, d.area].filter(Boolean).join(' · ')}
                    </AppText>
                    <AppText variant="caption" tone={d.state === 'skipped' || d.state === 'paused' ? 'muted' : 'accentDeep'}>
                      {d.state === 'ordered' ? `On the board · ${d.orderCode}` : d.state === 'skipped' ? 'Skipped' : d.state === 'paused' ? 'Paused' : 'Coming'}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          ))}
          <AppText variant="small" tone="muted">
            At each day’s cut-off its tiffins appear on your board as orders for their time, already paid by the plan.
          </AppText>
        </>
      ) : null}
    </ScreenShell>
  );
};

export default TiffinPlansScreen;
