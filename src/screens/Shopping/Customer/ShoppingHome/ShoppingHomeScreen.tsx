// ═══════════════════════════════════════════════════════
// MetroMatrix — Smart Shopping (opened from the home's Shopping card)
// ═══════════════════════════════════════════════════════
// Independent stores from your city, each in its own colours, under one
// roof — zero commission. The page leads with what's new (banners), then
// the ways in: categories, stores, new arrivals and what people are buying.

import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSaved, useShopBootstrap, useShopNav } from '@hooks/useShop';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { CategoryTile, ProductCard, ProductCardSkeleton, Skeleton, StoreCard } from '@custom/index';
import { BannerCarousel, SearchPill, SectionError, ShopSection, ShopTopBar } from '@components/shopping/ShopParts';
import type { HomeStackParamList } from '@/types';
import { loadShoppingHomeAsync, selectShoppingHome } from './shoppingHomeSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShoppingHome'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingTop: space.s8, paddingBottom: space.s40, gap: space.s32 },
    block: { gap: space.s16 },
    rail: { paddingHorizontal: gutter, gap: space.s12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: gutter, columnGap: space.s12, rowGap: space.s24 },
    skeleton: { paddingHorizontal: gutter, gap: space.s16 },
  });

const ShoppingHomeScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ShoppingHomeContent {...props} />
  </ServiceScope>
);

const ShoppingHomeContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { gutter, space, size, service } = useTheme();
  const { width } = useWindowDimensions();
  const s = useAppSelector(selectShoppingHome);
  const nav = useShopNav();
  const saved = useSaved();
  useShopBootstrap();

  const load = useCallback((refresh: boolean) => dispatch(loadShoppingHomeAsync({ refresh })), [dispatch]);
  useEffect(() => {
    if (s.status === 'idle') void load(false);
  }, [s.status, load]);

  // Two columns inside the gutters, space.s12 apart.
  const half = (Math.min(width, 640) - gutter * 2 - space.s12) / 2;
  const home = s.home;

  return (
    <View style={styles.root}>
      <ShopTopBar title="Smart Shopping" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={s.refreshing} onRefresh={() => load(true)} tintColor={service.accent} />}>
        <SearchPill label="Search products, stores and brands" onPress={nav.openSearch} />

        {!home && s.status === 'failed' ? <SectionError message={s.error.message} onRetry={() => load(false)} /> : null}

        {!home && s.status !== 'failed' ? (
          <View style={styles.skeleton}>
            <Skeleton height={(Math.min(width, 640) - gutter * 2) / size.bannerAspect} shape="lg" />
            <View style={styles.rail}>
              <ProductCardSkeleton width={size.railCard} />
            </View>
          </View>
        ) : null}

        {home ? (
          <>
            <BannerCarousel banners={home.banners} onOpen={nav.openBanner} />

            <View style={styles.block}>
              <ShopSection title="Categories" onSeeAll={() => navigation.navigate('CategoryBrowse')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {/* The sub-categories are where people shop; the tree is one tap away. */}
                {home.categories.flatMap(c => (c.children.length ? c.children : [c])).map(c => (
                  <CategoryTile key={c.id} name={c.name} icon={c.icon} onPress={() => nav.openList({ title: c.name, categoryId: c.id })} />
                ))}
              </ScrollView>
            </View>

            {home.featuredStores.length ? (
              <View style={styles.block}>
                <ShopSection title="Stores to know" subtitle="Independent, from your city and beyond" onSeeAll={() => navigation.navigate('StoreList')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {home.featuredStores.map(store => (
                    <StoreCard key={store.id} store={store} onPress={() => nav.openStore(store.slug, store.name)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {home.newThisWeek.length ? (
              <View style={styles.block}>
                <ShopSection title="New this week" onSeeAll={() => nav.openList({ title: 'New this week', sort: 'newest' })} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {home.newThisWeek.map(p => (
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
              </View>
            ) : null}

            {s.trending.length ? (
              <View style={styles.block}>
                <ShopSection title="Popular right now" onSeeAll={() => nav.openList({ title: 'Popular right now', sort: 'trending' })} />
                <View style={styles.grid}>
                  {s.trending.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      width={half}
                      onPress={() => nav.openProduct(p.id, p.name)}
                      saved={saved.isSaved(p.id)}
                      onToggleSave={() => void saved.toggle(p.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default ShoppingHomeScreen;
