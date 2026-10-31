// ═══════════════════════════════════════════════════════
// MetroMatrix — All stores
// ═══════════════════════════════════════════════════════
// Every store, featured first; the search runs on the server (and forgives
// typos), a page at a time as you scroll.

import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { useShopNav } from '../../hooks/useShop';
import { getStoresAPI } from '../../networks/shopping/catalogNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { Divider, EmptyState, InlineNotice, SkeletonLines, StoreCard, TextField } from '../../Custom-Components/index';
import { ShopTopBar } from '../../Components/shopping/ShopParts';
import type { HomeStackParamList } from '../../models';
import { selectStoreQuery, setStoreQuery } from './storeListSlice';
import { storeSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<HomeStackParamList, 'StoreList'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    search: { paddingHorizontal: gutter, paddingBottom: space.s8 },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    state: { paddingTop: space.s16 },
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
  const list = usePagedList((page, size) => getStoresAPI({ q: q || undefined }, page, size), storeSummaryPageSerializer, `stores|${q}`);

  return (
    <View style={styles.root}>
      <ShopTopBar title="Stores" onBack={back} />
      <View style={styles.search}>
        <TextField
          label="Search stores"
          value={query}
          onChangeText={t => dispatch(setStoreQuery(t))}
          icon="search"
          placeholder="Store name or what they sell"
          clearable
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={list.rows}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={service.accent} />}
        renderItem={({ item }) => <StoreCard store={item} variant="row" onPress={() => openStore(item.slug, item.name)} />}
        ListEmptyComponent={
          <View style={styles.state}>
            {list.isLoading ? (
              <SkeletonLines lines={6} />
            ) : list.error ? (
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            ) : q ? (
              <EmptyState icon="search" title={`No stores match "${q}"`} body="Check the spelling, or try what they sell." />
            ) : (
              <EmptyState icon="shopping-bag" title="No stores yet" body="Stores appear here as they open." />
            )}
          </View>
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </View>
  );
};

export default StoreList;
