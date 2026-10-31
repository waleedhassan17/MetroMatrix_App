// ═══════════════════════════════════════════════════════
// MetroMatrix — Smart Shopping (opened from the home's Shopping card)
// ═══════════════════════════════════════════════════════
// The brand list, as the FYP has it: search brands, the banners, the
// featured brands as round logos, then every brand as a photo card — its
// name and verified tick, tagline, story, what it sells and "Shop now".
// Products are a tap into a brand (or the search in the top bar).

import React, { useCallback, useEffect } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useServiceNav } from '../../../../hooks/useServiceNav';
import { useDebouncedValue, usePagedList } from '../../../../hooks/usePagedList';
import { useShopBootstrap, useShopNav } from '../../../../hooks/useShop';
import { getStoresAPI } from '../../../../networks/shopping/catalogNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  BrandCard,
  BrandLogo,
  EmptyState,
  IconButton,
  InlineNotice,
  Skeleton,
} from '../../../../Custom-Components/index';
import {
  BannerCarousel,
  SearchField,
  ShopSection,
  ShopTopBar,
} from '../../../../Components/shopping/ShopParts';
import type { HomeStackParamList, StoreSummary } from '../../../../types';
import { loadShoppingHomeAsync, selectShoppingHome, setBrandQuery } from './shoppingHomeSlice';
import { storeSummaryPageSerializer } from '../../../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShoppingHome'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { gap: space.s24, paddingTop: space.s20, paddingBottom: space.s16 },
    block: { gap: space.s12 },
    rail: { paddingHorizontal: gutter, gap: space.s8 },
    allHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
    },
    list: { paddingBottom: space.s40 },
    card: { paddingHorizontal: gutter, paddingBottom: space.s16 },
    state: { paddingHorizontal: gutter, gap: space.s16 },
  });

interface HeaderProps {
  searching: boolean;
  banners: React.ComponentProps<typeof BannerCarousel>['banners'];
  onBanner: React.ComponentProps<typeof BannerCarousel>['onOpen'];
  featured: StoreSummary[];
  onBrand: (b: StoreSummary) => void;
  total: number;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

/** A stable component handed to the list as an element, so the rails keep their scroll position. */
const BrandListHeader: React.FC<HeaderProps> = React.memo(function BrandListHeader({
  searching,
  banners,
  onBanner,
  featured,
  onBrand,
  total,
  loading,
  error,
  onRetry,
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      {error ? (
        <View style={styles.state}>
          <InlineNotice message={error} action={{ label: 'Try again', onPress: onRetry }} />
        </View>
      ) : null}
      {!searching ? (
        <>
          <BannerCarousel banners={banners} onOpen={onBanner} />
          {featured.length ? (
            <View style={styles.block}>
              <ShopSection
                title="Featured brands"
                subtitle={`${featured.length} top ${featured.length === 1 ? 'brand' : 'brands'}`}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}>
                {featured.map(b => (
                  <BrandLogo key={b.id} brand={b} onPress={() => onBrand(b)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      ) : null}
      {total > 0 || !loading ? (
        <View style={styles.allHead}>
          <AppText variant="h2" accessibilityRole="header">
            {searching ? 'Search results' : 'All brands'}
          </AppText>
          <AppText variant="small" tone="muted">
            {total} {total === 1 ? 'brand' : 'brands'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

const ShoppingHomeScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ShoppingHomeContent {...props} />
  </ServiceScope>
);

const ShoppingHomeContent: React.FC<Props> = () => {
  // The service's Home tab: back leaves the service for the three cards.
  const { leaveService: back } = useServiceNav();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const s = useAppSelector(selectShoppingHome);
  const nav = useShopNav();
  useShopBootstrap();

  const q = useDebouncedValue(s.brandQuery.trim());
  const brands = usePagedList(
    (page, sz) => getStoresAPI({ q: q || undefined }, page, sz),
    storeSummaryPageSerializer,
    `brands|${q}`,
  );

  const load = useCallback(
    (refresh: boolean) => dispatch(loadShoppingHomeAsync({ refresh })),
    [dispatch],
  );
  useEffect(() => {
    if (s.status === 'idle') void load(false);
  }, [s.status, load]);

  const openBrand = useCallback((b: StoreSummary) => nav.openStore(b.slug, b.name), [nav]);
  const onQuery = useCallback((t: string) => dispatch(setBrandQuery(t)), [dispatch]);
  const refresh = () => {
    void load(true);
    brands.refresh();
  };

  const header = (
    <BrandListHeader
      searching={q.length > 0}
      banners={s.home?.banners ?? []}
      onBanner={nav.openBanner}
      featured={s.home?.featuredStores ?? []}
      onBrand={openBrand}
      total={brands.total}
      loading={brands.isLoading}
      error={s.status === 'failed' && !s.home ? s.error.message : brands.error}
      onRetry={() => {
        void load(false);
        brands.reload();
      }}
    />
  );

  return (
    <View style={styles.root}>
      <ShopTopBar
        title="Smart Shopping"
        subtitle="Browse brands and stores"
        onBack={back}
        right={
          <IconButton
            icon="search"
            onPress={() => nav.openSearch()}
            accessibilityLabel="Search products"
          />
        }>
        <SearchField value={s.brandQuery} onChange={onQuery} placeholder="Search brands" />
      </ShopTopBar>
      <FlatList
        data={brands.rows}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <BrandCard brand={item} onPress={() => openBrand(item)} />
          </View>
        )}
        ListEmptyComponent={
          brands.isLoading ? (
            <View style={styles.state}>
              <Skeleton height={size.brandCard} shape="xl" />
              <Skeleton height={size.brandCard} shape="xl" />
            </View>
          ) : brands.error ? null : (
            <View style={styles.state}>
              <EmptyState
                icon="shopping-bag"
                title={q ? `No brands match "${q}"` : 'No brands yet'}
                body={
                  q
                    ? 'Check the spelling, or search by what they sell.'
                    : 'Brands appear here as they open.'
                }
              />
            </View>
          )
        }
        ListFooterComponent={
          brands.isLoadingMore ? (
            <View style={styles.state}>
              <Skeleton height={size.brandCard} shape="xl" />
            </View>
          ) : null
        }
        onEndReached={brands.loadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={s.refreshing || brands.isRefreshing}
            onRefresh={refresh}
            tintColor={service.accent}
          />
        }
      />
    </View>
  );
};

export default ShoppingHomeScreen;
