// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen (the vendor's Kitchen tab)
// ═══════════════════════════════════════════════════════
// Answers first: today's date and the assistant's meter, then up to five
// findings to act on (insight cards, one action each), then the kitchen's
// tools with one live number each. Two columns on a tablet.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useLayoutClass } from '../../hooks/useLayoutClass';
import { cardTarget } from '../../models/kitchen/insightCardModel';
import { usageFill, usageLine, usageNote } from '../../models/kitchen/aiModel';
import { HYGIENE_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { selectBusiness } from '../../store/authSlice';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Card, InlineNotice, InsightCard, ProgressBar, ScreenShell, SkeletonLines } from '../../Custom-Components/index';
import { IconWell, SectionHead, StatGrid, ToolSection, type AdminStat } from '../../Components/admin/AdminParts';
import { formatLongDate } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import type { KitchenSummary } from '../../models';
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

/** Reaching customers (5B), each with its live number. Cloud kitchens see demand first. */
const growTiles = (s: KitchenSummary, go: (name: string, params?: object) => void, cloud: boolean): AdminStat[] => {
  const g = s.growth;
  const tiles: AdminStat[] = [
    {
      key: 'tiffin',
      icon: 'calendar-outline',
      tint: 'amber',
      label: 'Tiffin',
      value: s.growth.tiffin.plans ? `${s.growth.tiffin.active}` : 'Start one',
      hint: s.growth.tiffin.plans
        ? `subscribers · ${s.growth.tiffin.tomorrow} tomorrow${s.growth.tiffin.pending ? ` · ${s.growth.tiffin.pending} to approve` : ''}`
        : 'weekly or monthly meals, paid ahead',
      onPress: () => go('GrowthTiffin'),
    },
    {
      key: 'catering',
      icon: 'people-outline',
      tint: 'violet',
      label: 'Catering',
      value: s.growth.catering.new ? `${s.growth.catering.new} new` : `${s.growth.catering.upcoming}`,
      hint: s.growth.catering.new ? `requests to quote · ${s.growth.catering.upcoming} coming up` : 'events coming up',
      onPress: () => go('GrowthCatering'),
    },
    {
      key: 'storefront',
      icon: 'qr-code-outline',
      tint: 'blue',
      label: 'Your link and QR',
      value: `${g.storefront.brought}`,
      hint: 'orders you brought this month',
      onPress: () => go('GrowthStorefront'),
    },
    {
      key: 'demand',
      icon: 'map-outline',
      tint: 'rose',
      label: 'Demand nearby',
      value: g.demand.unmet.toLocaleString('en-US'),
      hint: 'searches nearby found nothing open · 30 days',
      onPress: () => go('GrowthDemand'),
    },
    {
      key: 'menu',
      icon: 'analytics-outline',
      tint: 'violet',
      label: 'Menu insights',
      value: g.experiments.results ? `${g.experiments.results} to decide` : g.experiments.running ? `${g.experiments.running} testing` : 'See dishes',
      hint: g.experiments.results ? 'tests with a result' : 'what sells, what earns, and tests',
      onPress: () => go('GrowthMenuInsights'),
    },
    {
      key: 'story',
      icon: 'shield-checkmark-outline',
      tint: 'amber',
      label: 'Story and hygiene',
      value: HYGIENE_STATUS[g.hygiene].vendorLabel,
      hint: 'what customers read about you',
      onPress: () => go('GrowthStory'),
    },
    {
      key: 'ramadan',
      icon: 'moon-outline',
      tint: 'blue',
      label: 'Ramadan mode',
      value: g.ramadan.enabled ? 'On' : g.ramadan.state === 'none' ? 'Later' : 'Off',
      hint: g.ramadan.state === 'none' ? 'opens a month before Ramadan' : 'sehri and iftar hours',
      onPress: () => go('GrowthRamadan'),
    },
  ];
  return cloud ? [...tiles.filter(t => t.key === 'demand'), ...tiles.filter(t => t.key !== 'demand')] : tiles;
};

const KitchenHub: React.FC = () => (
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
  const cloud = useAppSelector(selectBusiness)?.subType === 'cloud_kitchen';

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadKitchenHubAsync());
    }, [dispatch]),
  );

  const go = (name: string, params?: object) => navigation.navigate(name, params);
  const note = usageNote(s.usage);

  const meter = s.usage ? (
    <Card onPress={() => go('KitchenAssistant')} accessibilityLabel={`${usageLine(s.usage)}. Opens the assistant.`}>
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
      <SectionHead title="Grow" />
      <StatGrid stats={growTiles(s.summary, go, cloud)} />
      <ToolSection
        title="Assistant"
        tools={[
          { key: 'assistant', title: 'Assistant', subtitle: 'Descriptions, specials, combos, photo tips', icon: 'sparkles-outline', tint: 'violet', value: s.usage ? `${s.usage.left} left` : undefined, onPress: () => go('KitchenAssistant') },
          { key: 'reviews', title: 'What reviews say', subtitle: 'The week’s themes, good and bad', icon: 'chatbubbles-outline', tint: 'rose', onPress: () => go('KitchenReviewInsights') },
          { key: 'nutrition', title: 'Nutrition', subtitle: 'Calories and macros per dish', icon: 'nutrition-outline', tint: 'blue', onPress: () => go('KitchenNutrition') },
        ]}
      />
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

export default KitchenHub;
