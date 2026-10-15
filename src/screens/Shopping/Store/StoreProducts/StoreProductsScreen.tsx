// ═══════════════════════════════════════════════════════
// MetroMatrix — The store's products
// ═══════════════════════════════════════════════════════
// Live, drafts and hidden, searchable by name or SKU, with stock at a
// glance. Tap one to edit; add a new one from the top.

import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useDebouncedValue, usePagedList } from '@hooks/usePagedList';
import { listPartnerProducts } from '@networks/shopping/partner/productsNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Divider, EmptyState, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, StatusPill, TextField } from '@custom/index';
import type { PartnerProductRow, PartnerProductStatus } from '@/types';
import { cdn } from '@utils/cdn';
import { formatPKR } from '@utils/money';
import { selectStoreProducts, setProductsQuery, setProductsShelf } from './storeProductsSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const SHELVES: { key: PartnerProductStatus; label: string }[] = [
  { key: 'active', label: 'Live' },
  { key: 'draft', label: 'Drafts' },
  { key: 'archived', label: 'Hidden' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    text: { flex: 1, gap: space.s4 },
    list: { paddingBottom: space.s40 },
  });

const stockLine = (p: PartnerProductRow): { text: string; tone: 'success' | 'warning' | 'danger' } =>
  p.totalStock === 0
    ? { text: 'Out of stock', tone: 'danger' }
    : p.lowStock
      ? { text: `${p.totalStock} in stock · some options low`, tone: 'warning' }
      : { text: `${p.totalStock} in stock`, tone: 'success' };

const ProductRow: React.FC<{ product: PartnerProductRow; onPress: () => void }> = ({ product, onPress }) => {
  const styles = useStyles(makeStyles);
  const { size, opacity } = useTheme();
  const stock = stockLine(product);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name || 'Untitled product'}, ${formatPKR(product.salePrice ?? product.price)}, ${stock.text}`}>
      {product.imageUrl ? (
        <Image source={{ uri: cdn(product.imageUrl, { w: size.thumb, h: size.thumb / size.productAspect }) ?? undefined }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={styles.thumb} />
      )}
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {product.name || 'Untitled product'}
        </AppText>
        <AppText variant="small">
          {product.salePrice ? `${formatPKR(product.salePrice)} (was ${formatPKR(product.price)})` : product.price ? formatPKR(product.price) : 'No price yet'}
        </AppText>
        <AppText variant="caption" tone={stock.tone}>
          {stock.text}
          {product.variantCount > 1 ? ` · ${product.variantCount} options` : ''}
        </AppText>
      </View>
      {product.status === 'draft' ? <StatusPill label="Draft" /> : null}
    </Pressable>
  );
};

const StoreProductsScreen: React.FC = () => (
  <ServiceScope service="shopping">
    <StoreProductsContent />
  </ServiceScope>
);

const StoreProductsContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<Nav>();
  const s = useAppSelector(selectStoreProducts);
  const q = useDebouncedValue(s.query.trim());
  const list = usePagedList((page, size) => listPartnerProducts({ status: s.status, q: q || undefined }, page, size), `store-products|${s.status}|${q}`);

  return (
    <ScreenShell
      title="Products"
      scroll={false}
      headerRight={<Button label="Add" size="sm" leftIcon="add" onPress={() => navigation.navigate('ProductForm')} />}>
      <SegmentTabs options={SHELVES} value={s.status} onChange={k => dispatch(setProductsShelf(k))} accessibilityLabel="Shelf" />
      <TextField label="Search" value={s.query} onChangeText={t => dispatch(setProductsQuery(t))} icon="search" placeholder="Name or SKU" clearable autoCorrect={false} />
      <FlatList
        data={list.rows}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <ProductRow product={item} onPress={() => navigation.navigate('ProductForm', { id: item.id })} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="package"
              title={q ? `Nothing matches "${q}"` : s.status === 'active' ? 'Nothing live yet' : s.status === 'draft' ? 'No drafts' : 'Nothing hidden'}
              body={s.status === 'active' ? 'Add your first product: photos, a price and stock, and it’s on sale.' : 'They’ll show here.'}
              action={s.status === 'active' && !q ? { label: 'Add a product', onPress: () => navigation.navigate('ProductForm') } : undefined}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ScreenShell>
  );
};

export default StoreProductsScreen;
