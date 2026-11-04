// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen (the vendor's Kitchen tab)
// ═══════════════════════════════════════════════════════
// The day's quick actions first, then up to five findings to act on (insight
// cards, one action each), today in four numbers, the assistant's meter, and
// every kitchen tool in four tinted groups — stock and prep, costs and
// waste, grow, the assistant — each row with its live count. A failed card
// list or meter says so in place. Two columns on a tablet.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useLayoutClass } from '../../hooks/useLayoutClass';
import { cardTarget } from '../../models/kitchen/insightCardModel';
import { HYGIENE_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { selectBusiness } from '../../store/authSlice';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, InlineNotice, InsightCard, RowCardsSkeleton, ScreenShell, StatGridSkeleton } from '../../Custom-Components/index';
import { QuickActionGrid, SectionHead, StatGrid, ToolSection, type AdminStat, type AdminTool } from '../../Components/admin/AdminParts';
import { AiMeterCard } from '../../Components/kitchen/AiMeterCard';
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
    loading: { gap: space.s16 },
  });

/** Today in four numbers (the words that explain each go in its hint). */
const todayTiles = (s: KitchenSummary, go: (name: string, params?: object) => void): AdminStat[] => {
  const alerts = s.stock.low + s.stock.negative;
  return [
    {
      key: 'stock',
      icon: 'cube-outline',
      tint: alerts ? 'amber' : 'green',
      label: 'Stock to check',
      value: alerts,
      hint: alerts ? `low or below zero · ${s.stock.expiring} expiring` : `${s.stock.total} ingredients, all fine`,
      onPress: () => go('KitchenStock', s.stock.low ? { segment: 'low' } : undefined),
    },
    {
      key: 'cost',
      icon: 'pie-chart-outline',
      tint: 'violet',
      label: 'Food cost (estimated)',
      value: s.recipes.avgFoodCostPct === null ? '—' : `${s.recipes.avgFoodCostPct}%`,
      hint: s.recipes.missing ? `${s.recipes.missing} dishes need a recipe card` : `target ${s.recipes.targetFoodCostPct}%`,
      onPress: () => go('KitchenRecipes'),
    },
    {
      key: 'spent',
      icon: 'cart-outline',
      tint: 'blue',
      label: 'Spent this week',
      value: formatPKR(s.purchases.weekTotal),
      hint: `${s.purchases.weekCount} ${s.purchases.weekCount === 1 ? 'purchase' : 'purchases'}`,
      onPress: () => go('KitchenPurchases'),
    },
    {
      key: 'waste',
      icon: 'leaf-outline',
      tint: 'red',
      label: 'Wasted this week',
      value: formatPKR(s.waste.weekCost),
      hint: `${s.waste.mealsRescued} ${s.waste.mealsRescued === 1 ? 'meal' : 'meals'} rescued in Bachat Boxes`,
      onPress: () => go('KitchenWaste'),
    },
  ];
};

/** The kitchen's tools, grouped; each section wears one tint, so colour means the group. */
const toolSections = (s: KitchenSummary, go: (name: string, params?: object) => void, cloud: boolean, assistantLeft: number | null): { title: string; tools: AdminTool[] }[] => {
  const g = s.growth;
  const grow: AdminTool[] = [
    { key: 'tiffin', title: 'Tiffin', subtitle: 'Weekly or monthly meals, paid ahead', icon: 'calendar-outline', tint: 'violet', value: g.tiffin.plans ? `${g.tiffin.active} on${g.tiffin.pending ? ` · ${g.tiffin.pending} to approve` : ''}` : 'Start one', onPress: () => go('GrowthTiffin') },
    { key: 'catering', title: 'Dawat and catering', subtitle: 'Requests, quotes and events', icon: 'people-outline', tint: 'violet', value: g.catering.new ? `${g.catering.new} new` : g.catering.upcoming ? `${g.catering.upcoming} coming` : undefined, onPress: () => go('GrowthCatering') },
    { key: 'storefront', title: 'Your link and QR', subtitle: 'Your own page to share', icon: 'qr-code-outline', tint: 'violet', value: g.storefront.brought ? `${g.storefront.brought} orders` : undefined, onPress: () => go('GrowthStorefront') },
    { key: 'demand', title: 'Demand nearby', subtitle: 'Searches near you that found nothing open', icon: 'map-outline', tint: 'violet', value: g.demand.unmet ? g.demand.unmet.toLocaleString('en-US') : undefined, onPress: () => go('GrowthDemand') },
    { key: 'menu', title: 'Menu insights', subtitle: 'What sells, what you keep, and tests', icon: 'analytics-outline', tint: 'violet', value: g.experiments.results ? `${g.experiments.results} to decide` : g.experiments.running ? `${g.experiments.running} testing` : undefined, onPress: () => go('GrowthMenuInsights') },
    { key: 'story', title: 'Story and hygiene', subtitle: 'What customers read about you', icon: 'shield-checkmark-outline', tint: 'violet', value: HYGIENE_STATUS[g.hygiene].vendorLabel, onPress: () => go('GrowthStory') },
    { key: 'ramadan', title: 'Ramadan mode', subtitle: g.ramadan.state === 'none' ? 'Opens a month before Ramadan' : 'Sehri and iftar hours', icon: 'moon-outline', tint: 'violet', value: g.ramadan.enabled ? 'On' : g.ramadan.state === 'none' ? undefined : 'Off', onPress: () => go('GrowthRamadan') },
  ];
  return [
    {
      title: 'Stock and prep',
      tools: [
        { key: 'forecast', title: 'Forecast and prep', subtitle: s.forecast.learning ? 'Still learning your orders' : `About ${s.forecast.orders} orders tomorrow (estimated)`, icon: 'clipboard-outline', tint: 'blue', value: s.forecast.learning ? undefined : `${s.forecast.dishes} dishes`, onPress: () => go('KitchenForecast') },
        { key: 'stock', title: 'Stock', subtitle: `${s.stock.total} ingredients`, icon: 'cube-outline', tint: 'blue', value: s.stock.low + s.stock.negative ? `${s.stock.low + s.stock.negative} to check` : undefined, onPress: () => go('KitchenStock') },
        { key: 'count', title: 'Count stock', subtitle: 'Walk the shelves and set what’s there', icon: 'list-outline', tint: 'blue', onPress: () => go('KitchenStockTake') },
        { key: 'purchases', title: 'Purchases', subtitle: 'What you bought, and receipts', icon: 'cart-outline', tint: 'blue', onPress: () => go('KitchenPurchases') },
        { key: 'suppliers', title: 'Suppliers', subtitle: 'Who you buy from', icon: 'storefront-outline', tint: 'blue', onPress: () => go('KitchenSuppliers') },
        { key: 'prices', title: 'Price watch', subtitle: 'What your ingredients cost lately', icon: 'trending-up-outline', tint: 'blue', onPress: () => go('KitchenPriceWatch') },
      ],
    },
    {
      title: 'Costs and waste',
      tools: [
        { key: 'recipes', title: 'Recipes and costs', subtitle: 'Cost to make and what you keep, per dish', icon: 'pie-chart-outline', tint: 'amber', value: s.recipes.missing ? `${s.recipes.missing} to add` : undefined, onPress: () => go('KitchenRecipes') },
        { key: 'waste', title: 'Waste and Bachat Box', subtitle: 'What was thrown, and what was rescued', icon: 'leaf-outline', tint: 'amber', onPress: () => go('KitchenWaste') },
        { key: 'donations', title: 'Donations', subtitle: 'Food you gave away', icon: 'heart-outline', tint: 'amber', onPress: () => go('KitchenDonations') },
        { key: 'settings', title: 'Costs, stock and the board', subtitle: 'Food-cost target, selling out by stock, packing photo, spoken orders', icon: 'settings-outline', tint: 'amber', onPress: () => go('KitchenSettings') },
      ],
    },
    { title: 'Grow', tools: cloud ? [...grow.filter(t => t.key === 'demand'), ...grow.filter(t => t.key !== 'demand')] : grow },
    {
      title: 'Assistant',
      tools: [
        { key: 'assistant', title: 'Assistant', subtitle: 'Descriptions, specials, combos, photo tips', icon: 'sparkles-outline', tint: 'teal', value: assistantLeft !== null ? `${assistantLeft} left` : undefined, onPress: () => go('KitchenAssistant') },
        { key: 'reviews', title: 'What reviews say', subtitle: 'The week’s themes, good and bad', icon: 'chatbubbles-outline', tint: 'teal', onPress: () => go('KitchenReviewInsights') },
        { key: 'nutrition', title: 'Nutrition', subtitle: 'Calories and macros per dish (estimated)', icon: 'nutrition-outline', tint: 'teal', onPress: () => go('KitchenNutrition') },
      ],
    },
  ];
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
  const reload = () => void dispatch(loadKitchenHubAsync());

  const quick = (
    <QuickActionGrid
      actions={[
        { key: 'purchase', icon: 'cart-outline', tint: 'blue', label: 'Add a purchase', onPress: () => go('KitchenPurchaseForm') },
        { key: 'count', icon: 'list-outline', tint: 'blue', label: 'Count stock', onPress: () => go('KitchenStockTake') },
        { key: 'waste', icon: 'trash-outline', tint: 'amber', label: 'Log waste', onPress: () => go('KitchenWasteForm') },
        { key: 'box', icon: 'gift-outline', tint: 'green', label: 'Bachat Box', onPress: () => go('KitchenBoxForm', { suggest: true }) },
        { key: 'recipes', icon: 'pie-chart-outline', tint: 'amber', label: 'Recipe costs', onPress: () => go('KitchenRecipes') },
        { key: 'assistant', icon: 'sparkles-outline', tint: 'teal', label: 'Assistant', onPress: () => go('KitchenAssistant') },
      ]}
    />
  );

  const meter = s.usage ? (
    <AiMeterCard usage={s.usage} onPress={() => go('KitchenAssistant')} />
  ) : s.partsFailed.usage ? (
    <InlineNotice message="The assistant’s meter didn’t load." action={{ label: 'Try again', onPress: reload }} />
  ) : null;

  const cards = (
    <View style={styles.cards}>
      <SectionHead title={s.cards.length ? 'Needs you' : 'All clear'} />
      {s.partsFailed.cards ? <InlineNotice message="What needs you didn’t load." action={{ label: 'Try again', onPress: reload }} /> : null}
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
      {!s.cards.length && !s.partsFailed.cards && s.status === 'succeeded' ? (
        <AppText variant="small" tone="muted">
          Nothing to act on right now. Stock, costs and tomorrow’s prep look fine.
        </AppText>
      ) : null}
    </View>
  );

  const today = s.summary ? (
    <View style={styles.stack}>
      <SectionHead title="This week" />
      <StatGrid stats={todayTiles(s.summary, go)} />
    </View>
  ) : null;

  const tools = s.summary ? (
    <View style={styles.stack}>
      {toolSections(s.summary, go, cloud, s.usage ? s.usage.left : null).map(sec => (
        <ToolSection key={sec.title} title={sec.title} tools={sec.tools} />
      ))}
    </View>
  ) : null;

  return (
    <ScreenShell
      title="Kitchen"
      subtitle={s.summary ? formatLongDate(`${s.summary.date}T07:00:00.000Z`, 'Asia/Karachi') : 'Stock, costs and tomorrow’s prep'}
      refreshing={s.status === 'loading' && !!s.summary}
      onRefresh={reload}>
      {s.status === 'failed' && !s.summary ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: reload }} /> : null}
      {quick}
      {!s.summary && s.status !== 'failed' ? (
        <View style={styles.loading}>
          <StatGridSkeleton count={4} />
          <RowCardsSkeleton count={3} />
        </View>
      ) : null}
      {s.summary ? (
        tablet ? (
          <View style={styles.columns}>
            <View style={styles.column}>
              {cards}
              {today}
              {meter}
            </View>
            <View style={styles.column}>{tools}</View>
          </View>
        ) : (
          <>
            {cards}
            {today}
            {meter}
            {tools}
          </>
        )
      ) : null}
    </ScreenShell>
  );
};

export default KitchenHub;
