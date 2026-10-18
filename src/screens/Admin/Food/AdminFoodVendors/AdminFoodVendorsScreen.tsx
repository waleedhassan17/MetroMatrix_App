// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Food Court vendors
// ═══════════════════════════════════════════════════════
// Every food vendor, by name, link or owner's email, filtered by kind and
// where it stands (live, setting up, paused, suspended). A row opens the
// vendor: feature, suspend, the food-safety check, the plan.

import React, { useEffect } from 'react';
import { FlatList, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue, usePagedList } from '@hooks/usePagedList';
import { listAdminFoodVendors } from '@networks/admin/adminFoodNetwork';
import { VENDOR_STATUS_FILTERS, vendorStanding } from '@models/food/adminFoodModel';
import { KITCHEN_KIND_NAME } from '@models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  ChoiceChip,
  EmptyState,
  InlineNotice,
  ScreenShell,
  SkeletonLines,
} from '@custom/index';
import { SearchField } from '@components/shopping/ShopParts';
import { RowCard } from '@components/admin/AdminParts';
import type { AdminFoodStackParamList, AdminVendorStatus, KitchenKind } from '@/types';
import {
  selectAdminFoodVendors,
  setFoodVendorsQuery,
  setFoodVendorsStatus,
  setFoodVendorsType,
} from './adminFoodVendorsSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodVendors'>;

const KINDS: { key: KitchenKind | 'all'; label: string }[] = [
  { key: 'all', label: 'Every kind' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'cloud_kitchen', label: 'Cloud kitchens' },
  { key: 'home_kitchen', label: 'Home kitchens' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { gap: space.s8 },
    list: { gap: space.s12, paddingTop: space.s4, paddingBottom: space.s40 },
  });

const AdminFoodVendorsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminFoodVendors);
  const q = useDebouncedValue(s.query.trim());
  const list = usePagedList(
    (page, size) =>
      listAdminFoodVendors(
        { q: q || undefined, type: s.type ?? undefined, status: s.status ?? undefined },
        page,
        size,
      ),
    `admin-food-vendors|${q}|${s.type}|${s.status}`,
  );

  // A link from the overview sets the filters once.
  useEffect(() => {
    if (route.params?.type !== undefined) dispatch(setFoodVendorsType(route.params.type));
    if (route.params?.status !== undefined) dispatch(setFoodVendorsStatus(route.params.status));
  }, [dispatch, route.params?.type, route.params?.status]);

  return (
    <ScreenShell
      title="Vendors"
      subtitle={
        list.isLoading
          ? 'Food Court'
          : `${list.total} ${list.total === 1 ? 'vendor' : 'vendors'} on Food Court`
      }
      onBack={back}
      scroll={false}
      headerContent={
        <>
          <SearchField
            value={s.query}
            onChange={t => dispatch(setFoodVendorsQuery(t))}
            placeholder="Name, link or owner's email"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chips}>
            {KINDS.map(k => (
              <ChoiceChip
                key={k.key}
                label={k.label}
                selected={(s.type ?? 'all') === k.key}
                onPress={() => dispatch(setFoodVendorsType(k.key === 'all' ? null : k.key))}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chips}>
            {VENDOR_STATUS_FILTERS.map(f => (
              <ChoiceChip
                key={f.key}
                label={f.label}
                selected={(s.status ?? 'all') === f.key}
                onPress={() =>
                  dispatch(
                    setFoodVendorsStatus(f.key === 'all' ? null : (f.key as AdminVendorStatus)),
                  )
                }
              />
            ))}
          </ScrollView>
        </>
      }>
      <ServiceScope service="food">
        <FlatList
          data={list.rows}
          keyExtractor={v => v.id}
          contentContainerStyle={styles.list}
          onRefresh={list.refresh}
          refreshing={list.isRefreshing}
          onEndReached={list.loadMore}
          renderItem={({ item: v }) => {
            const standing = vendorStanding(v);
            return (
              <RowCard
                title={v.name}
                mark={{ name: v.name }}
                lines={[
                  [v.subTypeLabel || KITCHEN_KIND_NAME[v.subType], v.city]
                    .filter(Boolean)
                    .join(' · '),
                  [
                    v.ratingCount
                      ? `${v.ratingAvg.toFixed(1)} from ${v.ratingCount}`
                      : 'No ratings yet',
                    `${v.orders30d} ${v.orders30d === 1 ? 'order' : 'orders'} in 30 days`,
                    v.isFeatured ? 'Featured' : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ]}
                pill={{ label: standing.label, tone: standing.tone }}
                onPress={() =>
                  navigation.navigate('AdminFoodVendor', {
                    id: v.id,
                    name: v.name,
                    featured: v.isFeatured,
                  })
                }
              />
            );
          }}
          ListEmptyComponent={
            list.isLoading ? (
              <SkeletonLines lines={6} />
            ) : list.error ? (
              <InlineNotice
                message={list.error}
                action={{ label: 'Try again', onPress: list.reload }}
              />
            ) : (
              <EmptyState
                icon="search"
                title="No vendors match"
                body="Try another name, kind or status."
              />
            )
          }
          ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
        />
      </ServiceScope>
      {list.error && list.rows.length ? (
        <AppText variant="caption" tone="danger">
          {list.error}
        </AppText>
      ) : null}
    </ScreenShell>
  );
};

export default AdminFoodVendorsScreen;
