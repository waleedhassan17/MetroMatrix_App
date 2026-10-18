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
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { percentLabel } from '@models/food/insightsModel';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Card, Divider, InlineNotice, ListRow, ProgressBar, ScreenShell, SkeletonLines } from '@custom/index';
import type { AdminFoodStackParamList } from '@/types';
import { loadFoodOverviewAsync, selectFoodOverview } from './foodOverviewSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'FoodOverview'>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Nav = Props['navigation'] & { getParent: () => { navigate: (name: string, params?: object) => void } | undefined };

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '40%', padding: space.s16, gap: space.s4, borderRadius: radius.lg, borderWidth: size.hairline, borderColor: colors.line },
    bar: { gap: space.s4, paddingVertical: space.s8 },
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

  const tiles: [string, string][] = o
    ? [
        ['Live vendors', String(o.activeVendors.total)],
        ['Orders today', String(o.ordersToday)],
        ['On their way now', String(o.activeOrders)],
        ['Accepted today', percentLabel(o.acceptanceRateToday)],
      ]
    : [];
  const most = Math.max(1, ...(o?.topCuisines.map(c => c.orders) ?? []));

  return (
    <ScreenShell eyebrow="Admin" title="Food Court" refreshing={s.status === 'loading' && !!o} onRefresh={() => void dispatch(loadFoodOverviewAsync())}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodOverviewAsync()) }} /> : null}
      {o?.waiting.foodSafetyChecks ? (
        <InlineNotice
          tone="warning"
          title={`${o.waiting.foodSafetyChecks} home ${o.waiting.foodSafetyChecks === 1 ? 'kitchen needs' : 'kitchens need'} a food-safety check`}
          message="They can't go live until staff record the check."
          action={{ label: 'See them', onPress: () => navigation.navigate('AdminFoodVendors', { type: 'home_kitchen', status: 'draft' }) }}
        />
      ) : null}
      {o?.waiting.approvals ? (
        <InlineNotice
          tone="info"
          title={`${o.waiting.approvals} food ${o.waiting.approvals === 1 ? 'business is' : 'businesses are'} waiting for approval`}
          message="Approvals are in the Approvals tab."
          action={{ label: 'Open approvals', onPress: () => (navigation as Nav).getParent()?.navigate('ApprovalsTab') }}
        />
      ) : null}
      {!o ? (
        s.error.message ? null : <SkeletonLines lines={4} />
      ) : (
        <>
          <View style={styles.grid}>
            {tiles.map(([label, value]) => (
              <View key={label} style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
                <AppText variant="h1">{value}</AppText>
                <AppText variant="small" tone="muted">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
          <AppText variant="small" tone="muted">
            {[
              plural(o.activeVendors.restaurant, 'restaurant'),
              plural(o.activeVendors.cloud_kitchen, 'cloud kitchen'),
              plural(o.activeVendors.home_kitchen, 'home kitchen'),
              o.autoRejectsToday ? `${plural(o.autoRejectsToday, 'order')} nobody answered today` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </>
      )}
      <Card padded="horizontal">
        <ListRow title="Vendors" subtitle="Feature, suspend, food-safety checks, plans" leftIcon="storefront-outline" onPress={() => navigation.navigate('AdminFoodVendors')} />
        <Divider />
        <ListRow title="Find an order" subtitle="By its FC- code, for a dispute" leftIcon="search-outline" onPress={() => navigation.navigate('AdminFoodOrders')} />
        <Divider />
        <ListRow title="Reviews" subtitle="Hide a review that breaks the rules" leftIcon="chatbox-ellipses-outline" onPress={() => navigation.navigate('AdminFoodReviews')} />
        <Divider />
        <ListRow title="Cuisines" subtitle="What customers browse, and in what order" leftIcon="restaurant-outline" onPress={() => navigation.navigate('AdminFoodCuisines')} />
        <Divider />
        <ListRow title="Home banners" subtitle="What the Food Court home leads with" leftIcon="images-outline" onPress={() => navigation.navigate('AdminFoodBanners')} />
      </Card>
      {o?.topCuisines.length ? (
        <Card>
          <AppText variant="title">Busiest cuisines this week</AppText>
          {o.topCuisines.map(c => (
            <View key={c.slug} style={styles.bar}>
              <View style={styles.barHead}>
                <AppText variant="body">{c.name}</AppText>
                <AppText variant="bodyStrong">{c.orders}</AppText>
              </View>
              <ProgressBar progress={c.orders / most} accessibilityLabel={`${c.name}: ${c.orders} orders`} />
            </View>
          ))}
        </Card>
      ) : null}
      <AppText variant="caption" tone="muted">
        MetroMatrix takes no commission. Vendors deliver with their own riders, and customers pay them directly.
      </AppText>
    </ScreenShell>
  );
};

export default FoodOverviewScreen;
