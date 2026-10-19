// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen (the vendor's Kitchen tab)
// ═══════════════════════════════════════════════════════
// Answers first: today's date and the assistant's meter, then up to five
// findings to act on (insight cards, one action each), then the kitchen's
// tools with one live number each. Two columns on a tablet.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useLayoutClass } from '@hooks/useLayoutClass';
import { cardTarget } from '@models/kitchen/insightCardModel';
import { usageFill, usageLine, usageNote } from '@models/kitchen/aiModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Card, InlineNotice, InsightCard, ProgressBar, ScreenShell, SkeletonLines } from '@custom/index';
import { IconWell, SectionHead, StatGrid, type AdminStat } from '@components/admin/AdminParts';
import { formatLongDate } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import type { KitchenSummary } from '@/types';
import { loadKitchenHubAsync, selectKitchenHub, snoozeCardAsync } from './kitchenHubSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    columns: { flexDirection: 'row', gap: space.s20, alignItems: 'flex-start' },
    column: { flex: 1, gap: space.s16 },
    stack: { gap: space.s16 },
    cards: { gap: space.s12 },
    meter: { gap: space.s8 },
    meterHead: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

/** The tools, each with its live number. */
const tiles = (s: KitchenSummary, go: (name: string, params?: object) => void): AdminStat[] => [
  {
    key: 'stock',
    icon: 'cube-outline',
    tint: 'blue',
    label: 'Stock',
    value: s.stock.low + s.stock.negative ? `${s.stock.low + s.stock.negative}` : 'All set',
    hint: s.stock.low + s.stock.negative ? `running low or below zero · ${s.stock.expiring} expiring` : `${s.stock.total} ingredients`,
    onPress: () => go('KitchenStock', s.stock.low ? { segment: 'low' } : undefined),
  },
  {
    key: 'recipes',
    icon: 'pie-chart-outline',
    tint: 'violet',
    label: 'Recipes and costs',
    value: s.recipes.avgFoodCostPct === null ? '—' : `${s.recipes.avgFoodCostPct}%`,
    hint: s.recipes.missing ? `average food cost · ${s.recipes.missing} need a recipe` : `average food cost · target ${s.recipes.targetFoodCostPct}%`,
    onPress: () => go('KitchenRecipes'),
  },
  {
    key: 'purchases',
    icon: 'cart-outline',
    tint: 'amber',
    label: 'Purchases',
    value: formatPKR(s.purchases.weekTotal),
    hint: `spent this week · ${s.purchases.weekCount} ${s.purchases.weekCount === 1 ? 'purchase' : 'purchases'}`,
    onPress: () => go('KitchenPurchases'),
  },
  {
    key: 'forecast',
    icon: 'clipboard-outline',
    tint: 'blue',
    label: 'Forecast and prep',
    value: s.forecast.learning ? 'Learning' : `${s.forecast.dishes}`,
    hint: s.forecast.learning ? `about ${s.forecast.dishes} dishes tomorrow, ranges still wide` : `dishes expected tomorrow · about ${s.forecast.orders} orders`,
    onPress: () => go('KitchenForecast'),
  },
  {
    key: 'waste',
    icon: 'leaf-outline',
    tint: 'rose',
    label: 'Waste and Bachat Box',
    value: formatPKR(s.waste.weekCost),
    hint: `wasted this week · ${s.waste.mealsRescued} ${s.waste.mealsRescued === 1 ? 'meal' : 'meals'} rescued`,
    onPress: () => go('KitchenWaste'),
  },
];

const KitchenHubScreen: React.FC = () => (
  <ServiceScope service="food">
    <KitchenHubContent />
  </ServiceScope>
);

const KitchenHubContent: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectKitchenHub);
  const tablet = useLayoutClass() === 'tablet';

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadKitchenHubAsync());
    }, [dispatch]),
  );

  const go = (name: string, params?: object) => navigation.navigate(name, params);
  const note = usageNote(s.usage);

  const meter = s.usage ? (
    <Card>
      <View style={styles.meter}>
        <View style={styles.meterHead}>
          <IconWell icon="sparkles-outline" tint="accent" />
          <View style={styles.grow}>
            <AppText variant="title">{usageLine(s.usage)}</AppText>
            <AppText variant="small" tone="muted">
              {note ?? 'Voice entry, receipt scans and drafts count. Nothing is saved until you confirm it.'}
            </AppText>
          </View>
        </View>
        <ProgressBar progress={1 - usageFill(s.usage)} accessibilityLabel={usageLine(s.usage)} />
      </View>
    </Card>
  ) : null;

  const cards = (
    <View style={styles.cards}>
      <SectionHead title={s.cards.length ? 'Needs you' : 'All clear'} />
      {s.cards.map(c => (
        <InsightCard
          key={c.id}
          card={c}
          onAction={() => {
            const t = cardTarget(c);
            go(t.screen, t.params);
          }}
          onDismiss={() => void dispatch(snoozeCardAsync(c.id))}
        />
      ))}
      {!s.cards.length && s.status === 'succeeded' ? (
        <AppText variant="small" tone="muted">
          Nothing to act on right now. Stock, costs and tomorrow’s prep look fine.
        </AppText>
      ) : null}
    </View>
  );

  const tools = s.summary ? (
    <View style={styles.stack}>
      <SectionHead title="Your kitchen" />
      <StatGrid stats={tiles(s.summary, go)} />
    </View>
  ) : null;

  return (
    <ScreenShell
      title="Kitchen"
      subtitle={s.summary ? formatLongDate(`${s.summary.date}T07:00:00.000Z`, 'Asia/Karachi') : 'Stock, costs and tomorrow’s prep'}
      refreshing={s.status === 'loading' && !!s.summary}
      onRefresh={() => void dispatch(loadKitchenHubAsync())}>
      {s.status === 'failed' && !s.summary ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadKitchenHubAsync()) }} /> : null}
      {!s.summary && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {s.summary ? (
        tablet ? (
          <View style={styles.columns}>
            <View style={styles.column}>
              {meter}
              {cards}
            </View>
            <View style={styles.column}>{tools}</View>
          </View>
        ) : (
          <>
            {meter}
            {cards}
            {tools}
          </>
        )
      ) : null}
    </ScreenShell>
  );
};

export default KitchenHubScreen;
