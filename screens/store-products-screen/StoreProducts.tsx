// ═══════════════════════════════════════════════════════
// MetroMatrix — The store's products
// ═══════════════════════════════════════════════════════
// Live, drafts and hidden, searchable by name or SKU (both in the header),
// each a raised card with its photo, price and stock; a pill only when
// something needs a look (low, out, a draft). Tap one to edit; add a new one
// from the header.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { fetchPartnerProducts } from '../../networks/shopping/partner/products';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { EmptyState, IconButton, InlineNotice, RowCardSkeleton, RowCardsSkeleton, ScreenShell, SegmentTabs } from '../../Custom-Components/index';
import { RowCard } from '../../Components/admin/AdminParts';
import { SearchField } from '../../Components/shopping/ShopParts';
import type { PartnerProductRow, PartnerProductStatus } from '../../models';
import { formatPKR } from '../../utils/money/money';
import { selectStoreProducts, setProductsQuery, setProductsShelf } from './storeProductsSlice';
import { partnerProductRowPageSerializer } from '../../serializers/shopping/partnerSerializer';

type Nav = { navigate: (name: string, params?: object) => void };

const SHELVES: { key: PartnerProductStatus; label: string }[] = [
  { key: 'active', label: 'Live' },
  { key: 'draft', label: 'Drafts' },
  { key: 'archived', label: 'Hidden' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40 },
    gap: { height: space.s12 },
    footer: { paddingTop: space.s12 },
  });

/** Stock in plain words, and a pill only when it needs a look. */
const stockOf = (p: PartnerProductRow): { line: string; pill: { label: string; tone: 'warning' | 'danger' | 'neutral' } | null } => {
  const options = p.variantCount > 1 ? ` · ${p.variantCount} options` : '';
  if (p.totalStock === 0) return { line: `Out of stock${options}`, pill: { label: 'Out', tone: 'danger' } };
  if (p.lowStock) return { line: `${p.totalStock} in stock · some options low${options}`, pill: { label: 'Low', tone: 'warning' } };
  return { line: `${p.totalStock} in stock${options}`, pill: p.status === 'draft' ? { label: 'Draft', tone: 'neutral' } : null };
};

const ProductRow: React.FC<{ product: PartnerProductRow; onPress: () => void }> = ({ product, onPress }) => {
  const stock = stockOf(product);
  const price = product.salePrice
    ? `${formatPKR(product.salePrice)} · was ${formatPKR(product.price)}`
    : product.price
      ? formatPKR(product.price)
      : 'No price yet';
  return (
    <RowCard
      mark={{ image: product.imageUrl }}
      title={product.name || 'Untitled product'}
      lines={[price, stock.line]}
      pill={stock.pill ?? undefined}
      chevron
      onPress={onPress}
    />
  );
};

const StoreProducts: React.FC = () => (
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
  const list = usePagedList((page, size) => fetchPartnerProducts({ status: s.status, q: q || undefined }, page, size), partnerProductRowPageSerializer, `store-products|${s.status}|${q}`);

  return (
    <ScreenShell
      title="Products"
      subtitle={list.total ? `${list.total} ${list.total === 1 ? 'product' : 'products'}` : undefined}
      scroll={false}
      headerRight={<IconButton icon="add" onPress={() => navigation.navigate('ProductForm')} accessibilityLabel="Add a product" />}
      headerContent={
        <>
          <SegmentTabs options={SHELVES} value={s.status} onChange={k => dispatch(setProductsShelf(k))} accessibilityLabel="Shelf" />
          <SearchField value={s.query} onChange={t => dispatch(setProductsQuery(t))} placeholder="Name or SKU" />
        </>
      }>
      <FlatList
        data={list.rows}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <ProductRow product={item} onPress={() => navigation.navigate('ProductForm', { id: item.id })} />}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              ion="pricetags-outline"
              title={q ? `Nothing matches "${q}"` : s.status === 'active' ? 'Nothing live yet' : s.status === 'draft' ? 'No drafts' : 'Nothing hidden'}
              body={s.status === 'active' ? 'Add your first product: photos, a price and stock, and it’s on sale.' : 'They’ll show here.'}
              action={s.status === 'active' && !q ? { label: 'Add a product', onPress: () => navigation.navigate('ProductForm') } : undefined}
            />
          )
        }
        ListFooterComponent={
          list.isLoadingMore ? (
            <View style={styles.footer}>
              <RowCardSkeleton />
            </View>
          ) : null
        }
      />
    </ScreenShell>
  );
};

export default StoreProducts;
