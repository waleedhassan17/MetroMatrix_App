// ═══════════════════════════════════════════════════════
// MetroMatrix — A store's own page
// ═══════════════════════════════════════════════════════
// The store's cover, mark and colours (StoreBrandScope), how it delivers and
// takes payment, how to reach it, then its products — by collection, in the
// order you choose, a page at a time.

import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { useShopBootstrap, useShopNav } from '../../hooks/useShop';
import { getProductsAPI } from '../../networks/shopping/catalogNetwork';
import { SORT_OPTIONS, sortLabel } from '../../models/shopping/filterModel';
import { policyLines, whatsappUrl } from '../../models/shopping/storePolicyModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  Card,
  ChoiceChip,
  IconButton,
  InlineNotice,
  IonIcon,
  Skeleton,
  SkeletonLines,
  StoreMark,
} from '../../Custom-Components/index';
import { ProductGrid, SectionError, ShopTopBar } from '../../Components/shopping/ShopParts';
import type { ProductSort, ShopBrowseParamList, StoreDetail } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { loadStoreAsync, selectStorePage, setStoreCollection, setStoreSort } from './storePageSlice';
import { productSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'StorePage'>;

const makeStyles = ({ colors, space, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { gap: space.s16, paddingBottom: space.s16 },
    cover: { width: '100%', backgroundColor: colors.surfaceSunk },
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.s16, paddingHorizontal: gutter },
    identityText: { flex: 1, gap: space.s4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: space.s4, flexWrap: 'wrap' },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    contact: { flexDirection: 'row', gap: space.s8 },
    policy: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter },
    sort: { flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.touch },
    skeleton: { gap: space.s16 },
    skeletonPad: { paddingHorizontal: gutter, gap: space.s12 },
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

const StoreHeader: React.FC<{ store: StoreDetail; total: number; slug: string; collectionId: string | null; sort: ProductSort; onSort: () => void }> = ({
  store,
  total,
  slug,
  collectionId,
  sort,
  onSort,
}) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size, service, motion } = useTheme();
  const { width } = useWindowDimensions();
  const [aboutOpen, setAboutOpen] = useState(false);
  const cover = cdn(store.coverUrl, { w: width, h: width / size.coverAspect });
  const lines = policyLines(store.policies);

  return (
    <View style={styles.header}>
      {cover ? (
        <Image source={{ uri: cover }} style={[styles.cover, { aspectRatio: size.coverAspect }]} contentFit="cover" transition={motion.imageFade} />
      ) : null}
      <View style={styles.identity}>
        <StoreMark store={store} />
        <View style={styles.identityText}>
          <AppText variant="h1" numberOfLines={2} accessibilityRole="header">
            {store.name}
          </AppText>
          {store.tagline ? (
            <AppText variant="small" tone="muted">
              {store.tagline}
            </AppText>
          ) : null}
          <View style={styles.meta}>
            {store.ratingCount > 0 ? (
              <>
                <IonIcon name="star" size="sm" color={colors.star} />
                <AppText variant="caption" tone="muted">
                  {store.rating.toFixed(1)} ({store.ratingCount}) ·
                </AppText>
              </>
            ) : null}
            <AppText variant="caption" tone="muted">
              {store.city} · {store.productCount} products
            </AppText>
          </View>
        </View>
      </View>

      {store.isPaused ? (
        <View style={styles.padded}>
          <InlineNotice
            tone="warning"
            title={`${store.name} is taking a break`}
            message={`${store.pauseMessage ? `${store.pauseMessage} ` : ''}You can look around; ordering opens when they're back.`}
          />
        </View>
      ) : null}

      <View style={styles.padded}>
        <Card>
          {lines.map(l => (
            <View key={l.icon} style={styles.policy}>
              <IonIcon name={l.icon} size="md" color={service.accentDeep} />
              <AppText variant="small">{l.text}</AppText>
            </View>
          ))}
        </Card>
        {store.about ? (
          <Pressable onPress={() => setAboutOpen(o => !o)} accessibilityRole="button" accessibilityLabel={aboutOpen ? 'Show less' : 'About this store, show more'}>
            <AppText variant="body" tone="muted" numberOfLines={aboutOpen ? undefined : 3}>
              {store.about}
            </AppText>
          </Pressable>
        ) : null}
        {store.whatsapp || store.phone ? (
          <View style={styles.contact}>
            {store.whatsapp ? (
              <Button
                label="WhatsApp"
                size="sm"
                variant="secondary"
                leftIcon="logo-whatsapp"
                onPress={() => void Linking.openURL(whatsappUrl(store.whatsapp!, `Hi ${store.name}, I found you on MetroMatrix.`))}
              />
            ) : null}
            {store.phone ? (
              <Button label="Call" size="sm" variant="secondary" leftIcon="call-outline" onPress={() => void Linking.openURL(`tel:${store.phone}`)} />
            ) : null}
          </View>
        ) : null}
      </View>

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

      <View style={styles.toolbar}>
        <AppText variant="small" tone="muted">
          {total} {total === 1 ? 'product' : 'products'}
        </AppText>
        <Pressable onPress={onSort} style={styles.sort} accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel(sort)}. Change`}>
          <IonIcon name="swap-vertical" size="sm" color={service.accentDeep} />
          <AppText variant="small" tone="accentDeep">
            {sortLabel(sort)}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
};

const StorePageContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const { width } = useWindowDimensions();
  const { slug } = route.params;
  const e = useAppSelector(s => selectStorePage(s, slug));
  const { openSearch } = useShopNav();
  const [sortOpen, setSortOpen] = useState(false);
  useShopBootstrap();

  useEffect(() => {
    void dispatch(loadStoreAsync(slug));
  }, [dispatch, slug]);

  const storeId = e.store?.id;
  const list = usePagedList(
    (page, pageSize) => getProductsAPI({ storeId, collectionId: e.collectionId ?? undefined, sort: e.sort }, page, pageSize),
    productSummaryPageSerializer,
    `store|${storeId}|${e.collectionId}|${e.sort}`,
    { enabled: !!storeId },
  );

  const title = e.store?.name ?? route.params.name ?? 'Store';
  const searchButton = e.store ? (
    <IconButton icon="search" onPress={() => openSearch({ storeId: e.store!.id, storeName: e.store!.name })} accessibilityLabel={`Search ${title}`} />
  ) : null;

  return (
    <View style={styles.root}>
      <ShopTopBar title={title} onBack={back} right={searchButton} />
      {!e.store ? (
        e.status === 'failed' ? (
          <SectionError message={e.error.message} onRetry={() => void dispatch(loadStoreAsync(slug))} />
        ) : (
          <View style={styles.skeleton}>
            <Skeleton height={width / size.coverAspect} shape="sm" />
            <View style={styles.skeletonPad}>
              <SkeletonLines lines={4} />
            </View>
          </View>
        )
      ) : (
        <ProductGrid
          list={list}
          showStore={false}
          header={
            <StoreHeader store={e.store} total={list.total} slug={slug} collectionId={e.collectionId} sort={e.sort} onSort={() => setSortOpen(true)} />
          }
          empty={{
            icon: 'shopping-bag',
            title: e.collectionId ? 'Nothing in this collection yet' : 'No products yet',
            body: e.collectionId ? 'Try another collection.' : `${title} hasn't listed anything yet.`,
          }}
        />
      )}
      <BottomSheetPicker
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort by"
        options={SORT_OPTIONS.map(o => ({ value: o.key, label: o.label }))}
        value={e.sort}
        onSelect={sort => {
          dispatch(setStoreSort({ slug, sort }));
          setSortOpen(false);
        }}
      />
    </View>
  );
};

export default StorePage;
