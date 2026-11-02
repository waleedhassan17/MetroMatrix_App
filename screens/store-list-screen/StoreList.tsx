// ═══════════════════════════════════════════════════════
// MetroMatrix — All stores
// ═══════════════════════════════════════════════════════
// Every store, featured first, each on its own card; the search sits in the
// header, runs on the server (and forgives typos), a page at a time.

import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { useShopNav } from '../../hooks/useShop';
import { fetchStores } from '../../networks/shopping/catalog';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { Card, EmptyState, InlineNotice, RowCardSkeleton, RowCardsSkeleton, StoreCard } from '../../Custom-Components/index';
import { SearchField, ShopTopBar } from '../../Components/shopping/ShopParts';
import type { HomeStackParamList } from '../../models';
import { selectStoreQuery, setStoreQuery } from './storeListSlice';
import { storeSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<HomeStackParamList, 'StoreList'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingTop: space.s20, paddingBottom: space.s40 },
    gap: { height: space.s12 },
    footer: { paddingTop: space.s12 },
  });

const StoreList: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreListContent {...props} />
  </ServiceScope>
);

const StoreListContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const query = useAppSelector(selectStoreQuery);
  const q = useDebouncedValue(query.trim());
  const { openStore } = useShopNav();
  const list = usePagedList((page, size) => fetchStores({ q: q || undefined }, page, size), storeSummaryPageSerializer, `stores|${q}`);

  return (
    <View style={styles.root}>
      <ShopTopBar title="Stores" subtitle={list.total ? `${list.total} on MetroMatrix` : undefined} onBack={back}>
        <SearchField value={query} onChange={t => dispatch(setStoreQuery(t))} placeholder="Store name or what they sell" />
      </ShopTopBar>
      <FlatList
        data={list.rows}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={service.accent} />}
        renderItem={({ item }) => (
          <Card padded="horizontal">
            <StoreCard store={item} variant="row" onPress={() => openStore(item.slug, item.name)} />
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : q ? (
            <EmptyState ion="search-outline" title={`No stores match "${q}"`} body="Check the spelling, or try what they sell." />
          ) : (
            <EmptyState ion="storefront-outline" title="No stores yet" body="Stores appear here as they open." />
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
    </View>
  );
};

export default StoreList;
