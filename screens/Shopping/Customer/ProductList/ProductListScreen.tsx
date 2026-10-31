// ═══════════════════════════════════════════════════════
// MetroMatrix — A list of products (category, collection, search, "new")
// ═══════════════════════════════════════════════════════
// Every product list in the shop is this screen with different params. The
// server filters, sorts and counts; the sheet shows how many products a
// filter change would leave before it is applied.

import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue, usePagedList } from '../../../../hooks/usePagedList';
import { useShopBootstrap } from '../../../../hooks/useShop';
import { getProductsAPI } from '../../../../networks/shopping/catalogNetwork';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filterContextKey,
  sortLabel,
  toProductQuery,
  type ProductFilters,
} from '../../../../models/shopping/filterModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, ChoiceChip, CountBadge, FilterSheet, IonIcon } from '../../../../Custom-Components/index';
import { ProductGrid, ShopTopBar } from '../../../../Components/shopping/ShopParts';
import type { ProductQuery, ShopBrowseParamList } from '../../../../types';
import { formatPKR } from '../../../../utils/money';
import {
  applyFilters,
  closeFilters,
  countDraftAsync,
  initList,
  openFilters,
  resetDraft,
  selectProductList,
  setDraft,
  setFilters,
} from './productListSlice';
import { productSummaryPageSerializer } from '../../../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'ProductList'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { gap: space.s12, paddingTop: space.s8, paddingBottom: space.s16 },
    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter, gap: space.s12 },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      minHeight: size.control.sm,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      borderWidth: size.border,
      borderColor: colors.line,
    },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
  });

/** The chips under the toolbar: one per applied filter, each removable. */
const appliedChips = (f: ProductFilters, ignoreCategory: boolean): { key: string; label: string; clear: Partial<ProductFilters> }[] => {
  const chips: { key: string; label: string; clear: Partial<ProductFilters> }[] = [];
  if (f.minPrice !== null || f.maxPrice !== null) {
    const label =
      f.minPrice !== null && f.maxPrice !== null
        ? `${formatPKR(f.minPrice)}–${formatPKR(f.maxPrice)}`
        : f.maxPrice !== null
          ? `Under ${formatPKR(f.maxPrice)}`
          : `Over ${formatPKR(f.minPrice!)}`;
    chips.push({ key: 'price', label, clear: { minPrice: null, maxPrice: null } });
  }
  if (f.minRating !== null) chips.push({ key: 'rating', label: `${f.minRating} stars & up`, clear: { minRating: null } });
  if (f.inStock) chips.push({ key: 'stock', label: 'In stock', clear: { inStock: false } });
  if (f.onSale) chips.push({ key: 'sale', label: 'On sale', clear: { onSale: false } });
  if (!ignoreCategory && f.categoryId) chips.push({ key: 'category', label: 'Category', clear: { categoryId: null } });
  return chips;
};

const ProductListScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ProductListContent {...props} />
  </ServiceScope>
);

const ProductListContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { title, q, storeId, categoryId, collectionId, sort, onSale } = route.params;
  useShopBootstrap();

  const context: ProductQuery = useMemo(() => ({ q, storeId, categoryId, collectionId }), [q, storeId, categoryId, collectionId]);
  const key = `${filterContextKey(context)}|${sort ?? ''}|${onSale ? 'sale' : ''}`;
  const initial = useMemo<ProductFilters>(
    () => ({ ...DEFAULT_FILTERS, sort: sort ?? (q ? 'relevance' : DEFAULT_FILTERS.sort), onSale: !!onSale }),
    [sort, onSale, q],
  );
  const e = useAppSelector(s => selectProductList(s, key));
  const filters = e?.filters ?? initial;

  useEffect(() => {
    dispatch(initList({ key, initial }));
  }, [dispatch, key, initial]);

  const query = useMemo(() => toProductQuery(context, filters), [context, filters]);
  const list = usePagedList((page, size) => getProductsAPI(query, page, size), productSummaryPageSerializer, `${key}|${JSON.stringify(query)}`);

  // The sheet's "Show N results": count the draft once editing pauses.
  const draft = useDebouncedValue(e?.draft ?? filters, 300);
  const sheetOpen = !!e?.sheetOpen;
  useEffect(() => {
    if (sheetOpen) void dispatch(countDraftAsync({ key, query: toProductQuery(context, draft) }));
  }, [sheetOpen, draft, context, key, dispatch]);

  const count = activeFilterCount(filters, { ignoreCategory: !!categoryId });
  const chips = appliedChips(filters, !!categoryId);

  const header = (
    <View style={styles.header}>
      <View style={styles.toolbar}>
        <AppText variant="small" tone="muted">
          {list.isLoading && !list.rows.length ? 'Loading…' : `${list.total} ${list.total === 1 ? 'product' : 'products'} · ${sortLabel(filters.sort)}`}
        </AppText>
        <Pressable
          onPress={() => dispatch(openFilters(key))}
          style={styles.filterButton}
          accessibilityRole="button"
          accessibilityLabel={count ? `Sort and filter, ${count} applied` : 'Sort and filter'}>
          <IonIcon name="options-outline" size="sm" color={colors.ink} />
          <AppText variant="small">Filter</AppText>
          {count ? <CountBadge count={count} /> : null}
        </Pressable>
      </View>
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map(c => (
            <ChoiceChip
              key={c.key}
              label={c.label}
              selected
              icon="close"
              accessibilityHint="Removes this filter"
              onPress={() => dispatch(setFilters({ key, filters: { ...filters, ...c.clear } }))}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <ShopTopBar title={title} onBack={back} />
      <ProductGrid
        list={list}
        header={header}
        showStore={!storeId}
        empty={{
          icon: 'search',
          title: count ? 'Nothing matches these filters' : q ? `No results for "${q}"` : 'Nothing here yet',
          body: count ? 'Loosen a filter to see more.' : q ? 'Check the spelling, or try a broader word.' : 'Check back soon.',
          action: count ? { label: 'Clear filters', onPress: () => dispatch(setFilters({ key, filters: { ...DEFAULT_FILTERS, sort: filters.sort } })) } : undefined,
        }}
      />
      {e ? (
        <FilterSheet
          visible={e.sheetOpen}
          onClose={() => dispatch(closeFilters(key))}
          draft={e.draft}
          onChange={d => dispatch(setDraft({ key, draft: d }))}
          resultCount={e.draftCount}
          onApply={() => dispatch(applyFilters(key))}
          onReset={() => dispatch(resetDraft(key))}
        />
      ) : null}
    </View>
  );
};

export default ProductListScreen;
