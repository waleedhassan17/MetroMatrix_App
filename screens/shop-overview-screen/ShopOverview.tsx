// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Shopping
// ═══════════════════════════════════════════════════════
// The shop at a glance (stores, live products, open reports, orders today)
// and the staff tools: reports first (they need someone), then categories,
// banners, featured stores and order lookup.

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { InlineNotice, ScreenShell } from '../../Custom-Components/index';
import { StatGrid, ToolSection, type AdminStat } from '../../Components/admin/AdminParts';
import type { AdminShopStackParamList } from '../../models';
import { loadShopOverviewAsync, selectShopOverview } from './shopOverviewSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopOverview'>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const ShopOverview: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectShopOverview);
  const o = s.overview;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadShopOverviewAsync());
    }, [dispatch]),
  );

  const stats: AdminStat[] = [
    { key: 'stores', icon: 'storefront-outline', value: o?.stores ?? null, label: 'Stores', hint: 'Approved on Shopping', onPress: () => navigation.navigate('ShopStores') },
    { key: 'products', icon: 'pricetags-outline', value: o?.activeProducts ?? null, label: 'Live products', hint: 'Shoppers can buy now' },
    { key: 'orders', icon: 'receipt-outline', value: o?.ordersToday ?? null, label: 'Orders today', hint: 'Since midnight', onPress: () => navigation.navigate('OrderLookup') },
    { key: 'reports', icon: 'flag-outline', value: o?.openReports ?? null, label: 'Open reports', hint: o ? (o.openReports ? 'Waiting for a decision' : 'Nothing waiting') : null, onPress: () => navigation.navigate('ShopReports') },
  ];

  return (
    <ScreenShell title="Shopping" subtitle="Stores, products and what shoppers report" refreshing={s.status === 'loading' && !!o} onRefresh={() => void dispatch(loadShopOverviewAsync())}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadShopOverviewAsync()) }} /> : null}
      <StatGrid stats={stats} />
      {o?.openReports ? (
        <ToolSection
          title="Needs you"
          tools={[
            {
              key: 'reports',
              title: `${plural(o.openReports, 'reported product')} to review`,
              subtitle: 'Keep it listed, or take it down',
              icon: 'flag-outline',
              onPress: () => navigation.navigate('ShopReports'),
            },
          ]}
        />
      ) : null}
      <ToolSection
        title="Manage"
        tools={[
          { key: 'categories', title: 'Categories', subtitle: 'The tree shoppers browse and stores file under', icon: 'git-branch-outline', onPress: () => navigation.navigate('ShopCategories') },
          { key: 'banners', title: 'Home banners', subtitle: 'What the Shopping home leads with', icon: 'images-outline', onPress: () => navigation.navigate('ShopBanners') },
          { key: 'stores', title: 'Stores', subtitle: 'Feature a store on the home', icon: 'storefront-outline', onPress: () => navigation.navigate('ShopStores') },
          { key: 'orders', title: 'Find an order', subtitle: 'By its MM- code', icon: 'search-outline', onPress: () => navigation.navigate('OrderLookup') },
          { key: 'reports', title: 'Reported products', subtitle: 'What shoppers flagged', icon: 'flag-outline', onPress: () => navigation.navigate('ShopReports') },
        ]}
      />
    </ScreenShell>
  );
};

export default ShopOverview;
