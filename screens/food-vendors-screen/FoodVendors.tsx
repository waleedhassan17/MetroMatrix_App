// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a list of vendors
// ═══════════════════════════════════════════════════════
// A cuisine, a home rail's "See all", or the pick-up places near you: the
// sort (a sheet) and the filter chips inside the header, then the kitchens
// a page at a time, open ones first, with the bag following along.

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchVendors } from '../../networks/food/discovery';
import { FILTERS, SORTS, filtersOf, listQuery, railList, type FoodRail } from '../../models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { BottomSheetPicker, ChoiceChip, EmptyState, InlineNotice, ScreenShell } from '../../Custom-Components/index';
import { VendorCardSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { FoodBagDock, useBagDockInset } from '../../Components/food/FoodParts';
import { VendorCard } from '../../Custom-Components/food/VendorCard';
import type { FoodAppParamList, VendorListQuery } from '../../models';
import { selectFoodPoint } from '../../store/preferencesSlice';
import { selectFoodVendors, setVendorSort, startVendorList, toggleVendorFilter } from './foodVendorsSlice';
import { vendorCardsPageSerializer } from '../../serializers/food/discoverySerializer';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodVendors'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    chipRail: { marginHorizontal: -gutter },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
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
  const { space } = useTheme();
  const dockInset = useBagDockInset();
  const [sorting, setSorting] = useState(false);
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
    (page: number, pageSize: number) => fetchVendors(JSON.parse(key) as VendorListQuery, page, pageSize),
    [key],
  );
  const list = usePagedList(fetchPage, vendorCardsPageSerializer, `food-vendors:${key}`, { enabled: !!query, keyOf: v => v.id });

  const sortLabel = SORTS.find(o => o.key === s.sort)?.label ?? 'Recommended';

  return (
    <ScreenShell
      title={params.title ?? 'Kitchens'}
      subtitle={point ? (pickup ? `Pick-up near ${point.label}` : `Delivering to ${point.label}`) : undefined}
      onBack={back}
      scroll={false}
      padded={false}
      headerContent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.chips}>
          <ChoiceChip label={`Sort: ${sortLabel}`} icon="swap-vertical-outline" onPress={() => setSorting(true)} accessibilityHint="Opens the sort choices" />
          {FILTERS.map(o => (
            <ChoiceChip key={o.key} label={o.label} selected={s.filters.includes(o.key)} onPress={() => dispatch(toggleVendorFilter(o.key))} />
          ))}
        </ScrollView>
      }
    >
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
            <EmptyState ion="location-outline" title="Choose your address" body="Go back to the Food Court and pick an address first." />
          ) : list.isLoading ? (
            <VendorCardSkeleton />
          ) : list.error ? (
            <View style={styles.padded}>
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            </View>
          ) : (
            <EmptyState ion="search-outline" title="Nothing matches" body="Try fewer filters, or another sort." />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <VendorCardSkeleton count={1} /> : null}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[styles.list, { paddingBottom: space.s40 + dockInset }]}
        refreshing={list.isRefreshing}
        onRefresh={list.refresh}
      />
      <FoodBagDock />
      <BottomSheetPicker
        visible={sorting}
        onClose={() => setSorting(false)}
        title="Sort kitchens"
        options={SORTS.map(o => ({ value: o.key, label: o.label }))}
        value={s.sort}
        onSelect={v => dispatch(setVendorSort(v))}
      />
    </ScreenShell>
  );
};

export default FoodVendors;
