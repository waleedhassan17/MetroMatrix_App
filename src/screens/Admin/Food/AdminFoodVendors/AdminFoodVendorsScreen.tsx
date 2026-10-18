// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Food Court vendors
// ═══════════════════════════════════════════════════════
// Every food vendor, by name, link or owner's email, filtered by kind and
// where it stands (live, setting up, paused, suspended). A row opens the
// vendor: feature, suspend, the food-safety check, the plan.

import React, { useEffect } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue, usePagedList } from '@hooks/usePagedList';
import { listAdminFoodVendors } from '@networks/admin/adminFoodNetwork';
import { VENDOR_STATUS_FILTERS, vendorStanding } from '@models/food/adminFoodModel';
import { KITCHEN_KIND_NAME } from '@models/food/vendorModel';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, ChoiceChip, Divider, EmptyState, IonIcon, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextField } from '@custom/index';
import type { AdminFoodStackParamList, AdminVendorStatus, KitchenKind } from '@/types';
import { selectAdminFoodVendors, setFoodVendorsQuery, setFoodVendorsStatus, setFoodVendorsType } from './adminFoodVendorsSlice';

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
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    list: { paddingBottom: space.s40 },
  });

const AdminFoodVendorsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectAdminFoodVendors);
  const q = useDebouncedValue(s.query.trim());
  const list = usePagedList((page, size) => listAdminFoodVendors({ q: q || undefined, type: s.type ?? undefined, status: s.status ?? undefined }, page, size), `admin-food-vendors|${q}|${s.type}|${s.status}`);

  // A link from the overview sets the filters once.
  useEffect(() => {
    if (route.params?.type !== undefined) dispatch(setFoodVendorsType(route.params.type));
    if (route.params?.status !== undefined) dispatch(setFoodVendorsStatus(route.params.status));
  }, [dispatch, route.params?.type, route.params?.status]);

  return (
    <ScreenShell title="Vendors" subtitle="Food Court" onBack={back} scroll={false}>
      <TextField label="Search" value={s.query} onChangeText={t => dispatch(setFoodVendorsQuery(t))} icon="search" placeholder="Name, link or owner's email" clearable autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {KINDS.map(k => (
          <ChoiceChip key={k.key} label={k.label} selected={(s.type ?? 'all') === k.key} onPress={() => dispatch(setFoodVendorsType(k.key === 'all' ? null : k.key))} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {VENDOR_STATUS_FILTERS.map(f => (
          <ChoiceChip key={f.key} label={f.label} selected={(s.status ?? 'all') === f.key} onPress={() => dispatch(setFoodVendorsStatus(f.key === 'all' ? null : (f.key as AdminVendorStatus)))} />
        ))}
      </ScrollView>
      <FlatList
        data={list.rows}
        keyExtractor={v => v.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        renderItem={({ item: v }) => {
          const standing = vendorStanding(v);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('AdminFoodVendor', { id: v.id, name: v.name, featured: v.isFeatured })}
              accessibilityRole="button"
              accessibilityLabel={`${v.name}, ${v.subTypeLabel || KITCHEN_KIND_NAME[v.subType]}, ${standing.label}`}>
              <View style={styles.grow}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {v.name}
                </AppText>
                <AppText variant="small" tone="muted" numberOfLines={1}>
                  {[v.subTypeLabel || KITCHEN_KIND_NAME[v.subType], v.city, v.ratingCount ? `${v.ratingAvg.toFixed(1)} (${v.ratingCount})` : null, `${v.orders30d} ${v.orders30d === 1 ? 'order' : 'orders'} in 30 days`].filter(Boolean).join(' · ')}
                </AppText>
                {v.isFeatured ? (
                  <AppText variant="caption" tone="accentDeep">
                    Featured
                  </AppText>
                ) : null}
              </View>
              <StatusPill label={standing.label} tone={standing.tone} />
              <IonIcon name="chevron-forward" size="sm" color={colors.inkFaint} />
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <AppText variant="caption" tone="muted">
            {`${list.total} ${list.total === 1 ? 'vendor' : 'vendors'}`}
          </AppText>
        }
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="search" title="No vendors match" body="Try another name, kind or status." />
          )
        }
      />
    </ScreenShell>
  );
};

export default AdminFoodVendorsScreen;
