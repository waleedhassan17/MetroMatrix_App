// ═══════════════════════════════════════════════════════
// MetroMatrix — A store's own page
// ═══════════════════════════════════════════════════════
// The FYP's brand store: the cover as a hero under the status bar, with the
// store's ringed mark, name and one line of facts on it and white circles
// floating over it (back; search and the Bag). Then what a shopper weighs
// (ships in, delivery, returns), the rest a tap away, and the products, by
// collection, in the order you pick. Once the cover scrolls away the white
// bar with the store's colour as a rule comes in, so back stays in reach. A
// store with no cover opens on that white bar. Everything wears the store's
// colours (StoreBrandScope).

import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { useShopBootstrap, useShopNav } from '../../hooks/useShop';
import { fetchProducts } from '../../networks/shopping/catalog';
import { SORT_OPTIONS } from '../../models/shopping/filterModel';
import { policyHighlights, policyLines, whatsappUrl } from '../../models/shopping/storePolicyModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  ChoiceChip,
  IconButton,
  InlineNotice,
  IonIcon,
  PhotoScrim,
  Sheet,
  StoreHeroSkeleton,
  StoreMark,
  TextAction,
} from '../../Custom-Components/index';
import {
  PhotoTopBar,
  PolicyStrip,
  ProductGrid,
  ProductGridSkeleton,
  SectionError,
  ShopSection,
  ShopTopBar,
} from '../../Components/shopping/ShopParts';
import type { ProductSort, ShopBrowseParamList, StoreDetail } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { loadStoreAsync, selectStorePage, setStoreCollection, setStoreSort } from './storePageSlice';
import { productSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'StorePage'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { gap: space.s16, paddingBottom: space.s16 },
    hero: { width: '100%', justifyContent: 'flex-end', backgroundColor: colors.ink },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroBody: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: gutter },
    heroText: { flex: 1, gap: space.s4 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.s16, paddingHorizontal: gutter, paddingTop: space.s20 },
    identityText: { flex: 1, gap: space.s4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: space.s4, flexWrap: 'wrap' },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
    fade: { position: 'absolute', top: space.s0, left: space.s0, right: space.s0 },
    bar: { position: 'absolute', top: space.s0, left: space.s0, right: space.s0 },
    policy: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    contact: { flexDirection: 'row', gap: space.s16 },
    loading: { gap: space.s20 },
    failed: { paddingTop: space.s20 },
  });

const StorePage: React.FC<Props> = props => {
  const entry = useAppSelector(s => selectStorePage(s, props.route.params.slug));
  return (
    <ServiceScope service="shopping">
      <StoreBrandScope brand={entry.store?.brandColor} onBrand={entry.store?.onBrandColor}>
        <StorePageContent {...props} />
      </StoreBrandScope>
    </ServiceScope>
  );
};

/** "Rated 4.6 · Lahore · 120 products" (`bare`: "4.6 · …", beside a star glyph). */
const factsLine = (store: StoreDetail, bare = false) =>
  [
    store.ratingCount > 0 ? `${bare ? '' : 'Rated '}${store.rating.toFixed(1)}` : null,
    store.city,
    `${store.productCount} products`,
  ]
    .filter(Boolean)
    .join(' · ');

const StoreHeader: React.FC<{
  store: StoreDetail;
  cover: string | null;
  total: number;
  slug: string;
  collectionId: string | null;
  sort: ProductSort;
  onMore: () => void;
}> = ({ store, cover, total, slug, collectionId, sort, onMore }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size, motion } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.header}>
      {cover ? (
        <View style={[styles.hero, { height: size.storeHero + insets.top }]}>
          <Image source={{ uri: cover }} style={styles.heroImage} contentFit="cover" transition={motion.imageFade} />
          <PhotoScrim strength="strong" />
          <View style={styles.heroBody}>
            <StoreMark store={store} size="hero" />
            <View style={styles.heroText}>
              <AppText variant="cardTitle" tone="onScrim" numberOfLines={1} accessibilityRole="header">
                {store.name}
              </AppText>
              <AppText variant="small" numberOfLines={1} style={{ color: colors.onScrimSoft }}>
                {[store.tagline, factsLine(store)].filter(Boolean).join(' · ')}
              </AppText>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.identity}>
          <StoreMark store={store} />
          <View style={styles.identityText}>
            <AppText variant="h2" numberOfLines={2} accessibilityRole="header">
              {store.name}
            </AppText>
            {store.tagline ? (
              <AppText variant="small" tone="muted" numberOfLines={1}>
                {store.tagline}
              </AppText>
            ) : null}
            <View style={styles.meta}>
              {store.ratingCount > 0 ? <IonIcon name="star" size="sm" color={colors.star} /> : null}
              <AppText variant="caption" tone="muted">
                {factsLine(store, true)}
              </AppText>
            </View>
          </View>
        </View>
      )}

      <View style={styles.padded}>
        {store.isPaused ? (
          <InlineNotice
            tone="warning"
            title={`${store.name} is taking a break`}
            message={`${store.pauseMessage ? `${store.pauseMessage} ` : ''}You can look around; ordering opens when they're back.`}
          />
        ) : null}
        <PolicyStrip lines={policyHighlights(store.policies)} />
        <TextAction label={`More about ${store.name}`} icon="information-circle-outline" onPress={onMore} />
      </View>

      <ShopSection
        title="Products"
        trailing={
          <AppText variant="small" tone="muted">
            {total} {total === 1 ? 'product' : 'products'}
          </AppText>
        }
      />
      {store.collections.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <ChoiceChip label="All" selected={!collectionId} onPress={() => dispatch(setStoreCollection({ slug, collectionId: null }))} />
          {store.collections.map(c => (
            <ChoiceChip
              key={c.id}
              label={c.name}
              selected={collectionId === c.id}
              onPress={() => dispatch(setStoreCollection({ slug, collectionId: c.id }))}
            />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel="Sort by">
        {SORT_OPTIONS.map(o => (
          <ChoiceChip
            key={o.key}
            label={o.label}
            icon={sort === o.key ? 'swap-vertical' : undefined}
            selected={sort === o.key}
            onPress={() => dispatch(setStoreSort({ slug, sort: o.key }))}
          />
        ))}
      </ScrollView>
    </View>
  );
};

/** About the store: its story, every policy, and how to reach it. */
const MoreSheet: React.FC<{ store: StoreDetail; visible: boolean; onClose: () => void }> = ({ store, visible, onClose }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={store.name} subtitle={store.tagline || undefined}>
      {store.about ? (
        <AppText variant="body" tone="muted">
          {store.about}
        </AppText>
      ) : null}
      {policyLines(store.policies).map(l => (
        <View key={l.icon} style={styles.policy}>
          <IonIcon name={l.icon} size="md" color={service.accentDeep} />
          <AppText variant="small">{l.text}</AppText>
        </View>
      ))}
      {store.whatsapp || store.phone ? (
        <View style={styles.contact}>
          {store.whatsapp ? (
            <TextAction
              label="WhatsApp"
              icon="logo-whatsapp"
              onPress={() => void Linking.openURL(whatsappUrl(store.whatsapp!, `Hi ${store.name}, I found you on MetroMatrix.`))}
            />
          ) : null}
          {store.phone ? <TextAction label="Call" icon="call-outline" onPress={() => void Linking.openURL(`tel:${store.phone}`)} /> : null}
        </View>
      ) : null}
    </Sheet>
  );
};

const StorePageContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, space } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { slug } = route.params;
  const e = useAppSelector(s => selectStorePage(s, slug));
  const { openSearch } = useShopNav();
  const [moreOpen, setMoreOpen] = useState(false);
  // The cover has scrolled away: the white bar takes over from the circles.
  const [pastHero, setPastHero] = useState(false);
  useShopBootstrap();

  useEffect(() => {
    void dispatch(loadStoreAsync(slug));
  }, [dispatch, slug]);

  const storeId = e.store?.id;
  const list = usePagedList(
    (page, pageSize) => fetchProducts({ storeId, collectionId: e.collectionId ?? undefined, sort: e.sort }, page, pageSize),
    productSummaryPageSerializer,
    `store|${storeId}|${e.collectionId}|${e.sort}`,
    { enabled: !!storeId },
  );

  const title = e.store?.name ?? route.params.name ?? 'Store';
  const cover = e.store ? cdn(e.store.coverUrl, { w: width, h: size.storeHero }) : null;
  const photoTop = !!cover;
  const search = () => e.store && openSearch({ storeId: e.store.id, storeName: e.store.name });
  const handOver = size.storeHero - size.headerBar;

  const whiteBar = (
    <ShopTopBar
      title={title}
      onBack={back}
      right={e.store ? <IconButton icon="search" onPress={search} accessibilityLabel={`Search ${title}`} /> : null}
    />
  );

  return (
    <View style={styles.root}>
      {photoTop ? null : whiteBar}
      {/* Until the store loads there is no cover, so the white bar is up. */}
      {!e.store ? (
        e.status === 'failed' ? (
          <View style={styles.failed}>
            <SectionError message={e.error.message} onRetry={() => void dispatch(loadStoreAsync(slug))} />
          </View>
        ) : (
          <View style={styles.loading}>
            <StoreHeroSkeleton />
            <ProductGridSkeleton />
          </View>
        )
      ) : (
        <ProductGrid
          list={list}
          showStore={false}
          onScrollY={photoTop ? y => setPastHero(y > handOver) : undefined}
          header={
            <StoreHeader
              store={e.store}
              cover={cover}
              total={list.total}
              slug={slug}
              collectionId={e.collectionId}
              sort={e.sort}
              onMore={() => setMoreOpen(true)}
            />
          }
          empty={{
            ion: 'bag-handle-outline',
            title: e.collectionId ? 'Nothing in this collection yet' : 'No products yet',
            body: e.collectionId ? 'Try another collection.' : `${title} hasn't listed anything yet.`,
          }}
        />
      )}
      {photoTop && !pastHero ? (
        <>
          <View style={[styles.fade, { height: insets.top + size.headerWell + space.s24 }]} pointerEvents="none">
            <PhotoScrim edge="top" />
          </View>
          <PhotoTopBar
            onBack={back}
            right={e.store ? <IconButton icon="search" appearance="circle" onPress={search} accessibilityLabel={`Search ${title}`} /> : null}
          />
        </>
      ) : null}
      {photoTop && pastHero ? <View style={styles.bar}>{whiteBar}</View> : null}
      {e.store ? <MoreSheet store={e.store} visible={moreOpen} onClose={() => setMoreOpen(false)} /> : null}
    </View>
  );
};

export default StorePage;
