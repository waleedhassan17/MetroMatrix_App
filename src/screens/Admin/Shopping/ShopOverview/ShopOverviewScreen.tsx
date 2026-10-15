// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Shopping
// ═══════════════════════════════════════════════════════
// The shop at a glance (stores, live products, open reports, orders today)
// and the staff tools: reports first (they need someone), then categories,
// banners, featured stores and order lookup.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Card, Divider, InlineNotice, ListRow, ScreenShell, SkeletonLines } from '@custom/index';
import type { AdminShopStackParamList } from '@/types';
import { loadShopOverviewAsync, selectShopOverview } from './shopOverviewSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopOverview'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '40%', padding: space.s16, gap: space.s4, borderRadius: radius.lg, borderWidth: size.hairline, borderColor: colors.line },
  });

const ShopOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectShopOverview);
  const o = s.overview;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadShopOverviewAsync());
    }, [dispatch]),
  );

  const tiles: [string, number | undefined][] = [
    ['Stores', o?.stores],
    ['Live products', o?.activeProducts],
    ['Open reports', o?.openReports],
    ['Orders today', o?.ordersToday],
  ];

  return (
    <ScreenShell eyebrow="Admin" title="Shopping">
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadShopOverviewAsync()) }} /> : null}
      {!o ? (
        <SkeletonLines lines={4} />
      ) : (
        <View style={styles.grid}>
          {tiles.map(([label, n]) => (
            <View key={label} style={styles.tile} accessible accessibilityLabel={`${label}: ${n ?? 0}`}>
              <AppText variant="h1">{n ?? 0}</AppText>
              <AppText variant="small" tone="muted">
                {label}
              </AppText>
            </View>
          ))}
        </View>
      )}
      <Card padded="horizontal">
        <ListRow
          title="Reported products"
          subtitle={o?.openReports ? `${o.openReports} waiting for a decision` : 'Nothing waiting'}
          leftIcon="flag-outline"
          onPress={() => navigation.navigate('ShopReports')}
        />
        <Divider />
        <ListRow title="Categories" subtitle="The tree shoppers browse and stores file under" leftIcon="git-branch-outline" onPress={() => navigation.navigate('ShopCategories')} />
        <Divider />
        <ListRow title="Home banners" subtitle="What the Shopping home leads with" leftIcon="images-outline" onPress={() => navigation.navigate('ShopBanners')} />
        <Divider />
        <ListRow title="Stores" subtitle="Feature a store on the home" leftIcon="storefront-outline" onPress={() => navigation.navigate('ShopStores')} />
        <Divider />
        <ListRow title="Find an order" subtitle="By its MM- code" leftIcon="search-outline" onPress={() => navigation.navigate('OrderLookup')} />
      </Card>
    </ScreenShell>
  );
};

export default ShopOverviewScreen;
