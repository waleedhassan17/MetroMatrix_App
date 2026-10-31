// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a list of vendors
// ═══════════════════════════════════════════════════════
// A cuisine, a home rail's "See all", or the pick-up places near you: sort
// chips, filter chips, and the vendors a page at a time, open ones first.

import React, { useCallback, useEffect } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { getVendorsAPI } from '../../networks/food/discoveryNetwork';
import { FILTERS, SORTS, filtersOf, listQuery, railList, type FoodRail } from '../../models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { ChoiceChip, EmptyState, InlineNotice, ScreenShell, Skeleton } from '../../Custom-Components/index';
import { VendorCard } from '../../Custom-Components/food/VendorCard';
import type { FoodAppParamList, VendorListQuery } from '../../models';
import { selectFoodPoint } from '../../store/preferencesSlice';
import { selectFoodVendors, setVendorSort, startVendorList, toggleVendorFilter } from './foodVendorsSlice';
import { vendorCardsPageSerializer } from '../../serializers/food/discoverySerializer';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodVendors'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    chips: { paddingHorizontal: gutter, gap: space.s8 },
    bars: { gap: space.s8, paddingBottom: space.s12 },
    row: { paddingBottom: space.s24 },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    list: { paddingBottom: space.s40 },
  });

const FoodVendors: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodVendorsContent {...props} />
  </ServiceScope>
);

const FoodVendorsContent: React.FC<Props> = ({ route, navigation }) => {
  const params = route.params ?? {};
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const point = useAppSelector(selectFoodPoint);
  const s = useAppSelector(selectFoodVendors);

  const base: Partial<VendorListQuery> = {
    ...(params.rail ? railList(params.rail as FoodRail) : null),
    ...(params.cuisine ? { cuisine: params.cuisine } : null),
    ...(params.pickup ? { pickup: true } : null),
  };
  const baseKey = JSON.stringify(base);
  useEffect(() => {
    const b = JSON.parse(baseKey) as Partial<VendorListQuery>;
    dispatch(startVendorList({ sort: b.sort ?? 'recommended', filters: filtersOf(b) }));
  }, [baseKey, dispatch]);

  const pickup = s.filters.includes('pickup');
  const query = point ? listQuery(point, { cuisine: params.cuisine }, s.sort, s.filters) : null;
  const key = JSON.stringify(query);
  const fetchPage = useCallback(
    (page: number, pageSize: number) => getVendorsAPI(JSON.parse(key) as VendorListQuery, page, pageSize),
    [key],
  );
  const list = usePagedList(fetchPage, vendorCardsPageSerializer, `food-vendors:${key}`, { enabled: !!query, keyOf: v => v.id });

  return (
    <ScreenShell title={params.title ?? 'Restaurants'} subtitle={point ? (pickup ? `Pick-up near ${point.label}` : `Delivering to ${point.label}`) : undefined} onBack={back} scroll={false} padded={false}>
      <View style={styles.bars}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SORTS.map(o => (
            <ChoiceChip key={o.key} label={o.label} selected={s.sort === o.key} onPress={() => dispatch(setVendorSort(o.key))} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(o => (
            <ChoiceChip key={o.key} label={o.label} selected={s.filters.includes(o.key)} onPress={() => dispatch(toggleVendorFilter(o.key))} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list.rows}
        keyExtractor={v => v.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <VendorCard vendor={item} pickup={pickup} onPress={() => navigation.navigate('FoodVendor', { slug: item.slug })} />
          </View>
        )}
        ListEmptyComponent={
          !point ? (
            <EmptyState icon="map-pin" title="Choose where to deliver" body="Go back to the Food Court and pick an address first." />
          ) : list.isLoading ? (
            <View style={styles.padded}>
              <Skeleton height={size.storeCard / size.vendorPhotoAspect} shape="lg" />
              <Skeleton height={size.storeCard / size.vendorPhotoAspect} shape="lg" />
            </View>
          ) : list.error ? (
            <View style={styles.padded}>
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            </View>
          ) : (
            <EmptyState icon="search" title="Nothing matches" body="Try fewer filters, or another sort." />
          )
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshing={list.isRefreshing}
        onRefresh={list.refresh}
      />
    </ScreenShell>
  );
};

export default FoodVendors;
