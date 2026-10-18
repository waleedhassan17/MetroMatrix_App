// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Food Court
// ═══════════════════════════════════════════════════════
// Food Court today (live vendors by kind, orders, how many the vendors
// accepted, the ones nobody answered), what is waiting on staff (approvals,
// home kitchens' food-safety checks), the week's busiest cuisines, and the
// tools: vendors, orders, reviews, cuisines and the home's banners.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { percentLabel } from '@models/food/insightsModel';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Card, InlineNotice, ProgressBar, ScreenShell } from '@custom/index';
import { SectionHead, StatGrid, ToolSection, type AdminStat } from '@components/admin/AdminParts';
import type { AdminFoodStackParamList } from '@/types';
import { loadFoodOverviewAsync, selectFoodOverview } from './foodOverviewSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'FoodOverview'>;

type Nav = Props['navigation'] & {
  getParent: () => { navigate: (name: string, params?: object) => void } | undefined;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s8 },
    bar: { gap: space.s4, paddingVertical: space.s4 },
    barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s8 },
  });

const FoodOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectFoodOverview);
  const o = s.overview;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFoodOverviewAsync());
    }, [dispatch]),
  );

  const kitchens = o ? o.activeVendors.cloud_kitchen + o.activeVendors.home_kitchen : 0;
  const stats: AdminStat[] = [
    {
      key: 'vendors',
      icon: 'storefront-outline',
      tint: 'violet',
      value: o?.activeVendors.total ?? null,
      label: 'Live vendors',
      hint: o
        ? `${plural(o.activeVendors.restaurant, 'restaurant')} · ${plural(kitchens, 'kitchen')}`
        : null,
      onPress: () => navigation.navigate('AdminFoodVendors', { status: 'live' }),
    },
    {
      key: 'orders',
      icon: 'receipt-outline',
      tint: 'blue',
      value: o?.ordersToday ?? null,
      label: 'Orders today',
      hint: 'Since midnight',
      onPress: () => navigation.navigate('AdminFoodOrders'),
    },
    {
      key: 'active',
      icon: 'bicycle-outline',
      tint: 'accent',
      value: o?.activeOrders ?? null,
      label: 'On their way now',
      hint: 'Accepted, cooking or out',
    },
    {
      key: 'accepted',
      icon: 'checkmark-done-outline',
      tint: 'amber',
      value: o ? percentLabel(o.acceptanceRateToday) : null,
      label: 'Accepted today',
      hint: !o
        ? null
        : o.acceptanceRateToday === null
        ? 'No orders yet today'
        : o.autoRejectsToday
        ? `${plural(o.autoRejectsToday, 'order')} not answered`
        : 'Every order answered',
    },
  ];
  const needs = [
    o?.waiting.foodSafetyChecks
      ? {
          key: 'safety',
          title: `${plural(o.waiting.foodSafetyChecks, 'home kitchen')} to check`,
          subtitle: 'Food safety, before it can go live',
          icon: 'shield-checkmark-outline' as const,
          tint: 'amber' as const,
          onPress: () =>
            navigation.navigate('AdminFoodVendors', { type: 'home_kitchen', status: 'draft' }),
        }
      : null,
    o?.waiting.approvals
      ? {
          key: 'approvals',
          title: `${plural(o.waiting.approvals, 'application')} to approve`,
          subtitle: 'Food businesses, in the Approvals tab',
          icon: 'hourglass-outline' as const,
          tint: 'blue' as const,
          onPress: () => (navigation as Nav).getParent()?.navigate('ApprovalsTab'),
        }
      : null,
  ].filter(<T,>(x: T | null): x is T => x !== null);
  const most = Math.max(1, ...(o?.topCuisines.map(c => c.orders) ?? []));

  return (
    <ScreenShell
      eyebrow="Admin"
      title="Food Court"
      subtitle={o ? dayjs(o.date).format('dddd, D MMMM') : 'Today on Food Court'}
      refreshing={s.status === 'loading' && !!o}
      onRefresh={() => void dispatch(loadFoodOverviewAsync())}>
      {s.error.message ? (
        <InlineNotice
          message={s.error.message}
          action={{ label: 'Try again', onPress: () => void dispatch(loadFoodOverviewAsync()) }}
        />
      ) : null}
      <StatGrid stats={stats} />
      {needs.length ? <ToolSection title="Needs you" tools={needs} /> : null}
      <ToolSection
        title="Manage"
        tools={[
          {
            key: 'vendors',
            title: 'Vendors',
            subtitle: 'Feature, suspend, food-safety checks, plans',
            icon: 'storefront-outline',
            tint: 'violet',
            onPress: () => navigation.navigate('AdminFoodVendors'),
          },
          {
            key: 'orders',
            title: 'Find an order',
            subtitle: 'By its FC- code, for a dispute',
            icon: 'search-outline',
            tint: 'blue',
            onPress: () => navigation.navigate('AdminFoodOrders'),
          },
          {
            key: 'reviews',
            title: 'Reviews',
            subtitle: 'Hide a review that breaks the rules',
            icon: 'chatbox-ellipses-outline',
            tint: 'rose',
            onPress: () => navigation.navigate('AdminFoodReviews'),
          },
          {
            key: 'cuisines',
            title: 'Cuisines',
            subtitle: 'What customers browse, and in what order',
            icon: 'restaurant-outline',
            tint: 'amber',
            onPress: () => navigation.navigate('AdminFoodCuisines'),
          },
          {
            key: 'banners',
            title: 'Home banners',
            subtitle: 'What the Food Court home leads with',
            icon: 'images-outline',
            tint: 'grey',
            onPress: () => navigation.navigate('AdminFoodBanners'),
          },
        ]}
      />
      {o?.topCuisines.length ? (
        <View style={styles.section}>
          <SectionHead title="Busiest cuisines this week" />
          <Card>
            {o.topCuisines.map(c => (
              <View key={c.slug} style={styles.bar}>
                <View style={styles.barHead}>
                  <AppText variant="body">{c.name}</AppText>
                  <AppText variant="bodyStrong">{plural(c.orders, 'order')}</AppText>
                </View>
                <ProgressBar
                  progress={c.orders / most}
                  accessibilityLabel={`${c.name}: ${c.orders} orders`}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
      <AppText variant="caption" tone="muted">
        MetroMatrix takes no commission. Vendors deliver with their own riders, and customers pay
        them directly.
      </AppText>
    </ScreenShell>
  );
};

export default FoodOverviewScreen;
