// ═══════════════════════════════════════════════════════
// MetroMatrix — Smart Shopping (opened from the home's Shopping card)
// ═══════════════════════════════════════════════════════
// The FYP's Explore page, with the shop's own rails: one search (products,
// stores and brands) in the header; then the banners, "Shop by category" as
// photo tiles, the featured brands as round logos, "New this week" as a rail
// of product cards, and every brand as a photo card. Each section head is the
// same ShopSection, 24 apart.

import React, { useCallback, useEffect } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useServiceNav } from '../../hooks/useServiceNav';
import { usePagedList } from '../../hooks/usePagedList';
import { useSaved, useShopBootstrap, useShopNav } from '../../hooks/useShop';
import { fetchStores } from '../../networks/shopping/catalog';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BrandCard,
  BrandLogo,
  CategoryRailSkeleton,
  CategoryTile,
  EmptyState,
  InlineNotice,
  ProductCard,
  ProductCardSkeleton,
  Skeleton,
} from '../../Custom-Components/index';
import { BannerCarousel, SearchPill, ShopSection, ShopTopBar } from '../../Components/shopping/ShopParts';
import { CATEGORY_PHOTOS } from '../../Components/shopping/shopPhotos';
import type { HomeStackParamList, ProductSummary, ShopCategory, StoreSummary } from '../../models';
import { loadShoppingHomeAsync, selectShoppingHome } from './shoppingHomeSlice';
import { storeSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShoppingHome'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { gap: space.s24, paddingTop: space.s20, paddingBottom: space.s16 },
    block: { gap: space.s12 },
    // Rails keep a little room under them so the cards' shadows aren't cut.
    rail: { paddingHorizontal: gutter, paddingBottom: space.s4, gap: space.s12 },
    logos: { paddingHorizontal: gutter, gap: space.s8 },
    list: { paddingBottom: space.s40 },
    card: { paddingHorizontal: gutter, paddingBottom: space.s16 },
    state: { paddingHorizontal: gutter, gap: space.s16 },
  });

interface HeaderProps {
  banners: React.ComponentProps<typeof BannerCarousel>['banners'];
  onBanner: React.ComponentProps<typeof BannerCarousel>['onOpen'];
  categories: ShopCategory[];
  onCategory: (c: ShopCategory) => void;
  onAllCategories: () => void;
  featured: StoreSummary[];
  onBrand: (b: StoreSummary) => void;
  onAllBrands: () => void;
  fresh: ProductSummary[];
  onAllNew: () => void;
  loadingHome: boolean;
  total: number;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

/** "New this week": product cards in a rail, the heart on each. */
const NewRail: React.FC<{ products: ProductSummary[] }> = ({ products }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const nav = useShopNav();
  const saved = useSaved();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {products.map(p => (
        <ProductCard
          key={p.id}
          product={p}
          width={size.railCard}
          onPress={() => nav.openProduct(p.id, p.name)}
          saved={saved.isSaved(p.id)}
          onToggleSave={() => void saved.toggle(p.id)}
        />
      ))}
    </ScrollView>
  );
};

/** A stable component handed to the list as an element, so the rails keep their scroll position. */
const HomeHeader: React.FC<HeaderProps> = React.memo(function HomeHeader(h) {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const roots = h.categories.filter(c => !c.parentId);
  return (
    <View style={styles.header}>
      {h.error ? (
        <View style={styles.state}>
          <InlineNotice message={h.error} action={{ label: 'Try again', onPress: h.onRetry }} />
        </View>
      ) : null}
      <BannerCarousel banners={h.banners} onOpen={h.onBanner} />

      {roots.length || h.loadingHome ? (
        <View style={styles.block}>
          <ShopSection title="Shop by category" onSeeAll={roots.length ? h.onAllCategories : undefined} />
          {roots.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {roots.map(c => (
                <CategoryTile
                  key={c.id}
                  variant="photo"
                  name={c.name}
                  icon={c.icon}
                  photo={CATEGORY_PHOTOS[c.slug] ?? null}
                  onPress={() => h.onCategory(c)}
                />
              ))}
            </ScrollView>
          ) : (
            <CategoryRailSkeleton />
          )}
        </View>
      ) : null}

      {h.featured.length ? (
        <View style={styles.block}>
          <ShopSection title="Featured brands" onSeeAll={h.onAllBrands} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.logos}>
            {h.featured.map(b => (
              <BrandLogo key={b.id} brand={b} onPress={() => h.onBrand(b)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {h.fresh.length || h.loadingHome ? (
        <View style={styles.block}>
          <ShopSection title="New this week" onSeeAll={h.fresh.length ? h.onAllNew : undefined} />
          {h.fresh.length ? (
            <NewRail products={h.fresh} />
          ) : (
            <View style={styles.rail}>
              <ProductCardSkeleton width={size.railCard} />
            </View>
          )}
        </View>
      ) : null}

      {h.total > 0 || !h.loading ? (
        <ShopSection
          title="All brands"
          trailing={
            <AppText variant="small" tone="muted">
              {h.total} {h.total === 1 ? 'brand' : 'brands'}
            </AppText>
          }
        />
      ) : null}
    </View>
  );
});

const ShoppingHome: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ShoppingHomeContent {...props} />
  </ServiceScope>
);

const ShoppingHomeContent: React.FC<Props> = ({ navigation }) => {
  // The service's Home tab: back leaves the service for the three cards.
  const { leaveService: back } = useServiceNav();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const s = useAppSelector(selectShoppingHome);
  const nav = useShopNav();
  useShopBootstrap();

  const brands = usePagedList((page, sz) => fetchStores({}, page, sz), storeSummaryPageSerializer, 'brands');

  const load = useCallback(
    (refresh: boolean) => dispatch(loadShoppingHomeAsync({ refresh })),
    [dispatch],
  );
  useEffect(() => {
    if (s.status === 'idle') void load(false);
  }, [s.status, load]);

  const openBrand = useCallback((b: StoreSummary) => nav.openStore(b.slug, b.name), [nav]);
  const refresh = () => {
    void load(true);
    brands.refresh();
  };

  const header = (
    <HomeHeader
      banners={s.home?.banners ?? []}
      onBanner={nav.openBanner}
      categories={s.home?.categories ?? []}
      onCategory={c => nav.openList({ title: c.name, categoryId: c.id })}
      onAllCategories={() => navigation.navigate('CategoryBrowse')}
      featured={s.home?.featuredStores ?? []}
      onBrand={openBrand}
      onAllBrands={() => navigation.navigate('StoreList')}
      fresh={s.home?.newThisWeek ?? []}
      onAllNew={() => nav.openList({ title: 'New this week', sort: 'newest' })}
      loadingHome={!s.home && s.status !== 'failed'}
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
      <ShopTopBar title="Smart Shopping" subtitle="Brands, stores and new arrivals" onBack={back}>
        <SearchPill label="Search products, stores and brands" onPress={() => nav.openSearch()} />
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
              <EmptyState ion="storefront-outline" title="No brands yet" body="Brands appear here as they open." />
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

export default ShoppingHome;
