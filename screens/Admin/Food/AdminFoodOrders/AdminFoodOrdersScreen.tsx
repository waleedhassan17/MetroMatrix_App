// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: find a Food Court order
// ═══════════════════════════════════════════════════════
// For disputes: an order by its FC- code, or a vendor's orders, newest
// first. Read-only: staff see every event, but the vendor and customer act.

import React, { useEffect } from 'react';
import { FlatList, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue, usePagedList } from '../../../../hooks/usePagedList';
import { getAdminFoodOrdersAPI } from '../../../../networks/admin/adminFoodNetwork';
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  orderStatusLabel,
  pillTone,
} from '../../../../models/food/foodStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { ChoiceChip, EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { SearchField } from '../../../../Components/shopping/ShopParts';
import { RowCard } from '../../../../Components/admin/AdminParts';
import type { AdminFoodStackParamList, FoodOrderStatus } from '../../../../types';
import { formatDateTime } from '../../../../utils/dates';
import { formatPKR } from '../../../../utils/money';
import {
  selectAdminFoodOrders,
  setFoodOrderCode,
  setFoodOrdersStatus,
  setFoodOrdersVendor,
} from './adminFoodOrdersSlice';
import { adminFoodOrdersPageSerializer } from '../../../../serializers/food/adminFoodSerializer';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodOrders'>;

const STATUSES: (FoodOrderStatus | null)[] = [
  null,
  'placed',
  'preparing',
  'on_the_way',
  'delivered',
  'cancelled',
  'rejected',
  'auto_rejected',
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { gap: space.s8 },
    list: { gap: space.s12, paddingTop: space.s4, paddingBottom: space.s40 },
  });

const AdminFoodOrdersScreen: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminFoodOrders);
  const code = useDebouncedValue(s.code.trim());
  const searching = code.length >= 4 ? code : '';
  const list = usePagedList(
    (page, size) =>
      getAdminFoodOrdersAPI({ code: searching || undefined, vendorId: s.vendor?.id, status: s.status ?? undefined }, page, size),
    adminFoodOrdersPageSerializer,
    `admin-food-orders|${searching}|${s.vendor?.id}|${s.status}`,
  );

  // A vendor's "All orders" link narrows the list to it.
  useEffect(() => {
    if (route.params?.vendorId)
      dispatch(setFoodOrdersVendor({ id: route.params.vendorId, name: route.params.name ?? null }));
    if (route.params?.code) dispatch(setFoodOrderCode(route.params.code));
  }, [dispatch, route.params?.vendorId, route.params?.name, route.params?.code]);

  return (
    <ScreenShell
      title="Find an order"
      subtitle={
        s.vendor?.name ? `${s.vendor.name}’s orders` : 'Every Food Court order, newest first'
      }
      onBack={back}
      scroll={false}
      headerContent={
        <>
          <SearchField
            value={s.code}
            onChange={t => dispatch(setFoodOrderCode(t))}
            placeholder="Order code, e.g. FC-7KQ2PX"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chips}>
            {s.vendor ? (
              <ChoiceChip
                label={s.vendor.name ?? 'This vendor'}
                icon="close"
                selected
                onPress={() => dispatch(setFoodOrdersVendor(null))}
              />
            ) : null}
            {STATUSES.map(st => (
              <ChoiceChip
                key={st ?? 'all'}
                label={st ? ORDER_STATUS[st].label : 'Any status'}
                selected={s.status === st}
                onPress={() => dispatch(setFoodOrdersStatus(st))}
              />
            ))}
          </ScrollView>
        </>
      }>
      <ServiceScope service="food">
        <FlatList
          data={list.rows}
          keyExtractor={o => o.id}
          contentContainerStyle={styles.list}
          onRefresh={list.refresh}
          refreshing={list.isRefreshing}
          onEndReached={list.loadMore}
          renderItem={({ item: o }) => (
            <RowCard
              title={o.code}
              mark={{
                icon: o.fulfilment === 'pickup' ? 'bag-handle-outline' : 'bicycle-outline',
                tint: 'accent',
              }}
              lines={[
                [o.customerName, o.itemsSummary].filter(Boolean).join(' · '),
                `${formatDateTime(o.placedAt)} · ${PAYMENT_METHOD[o.payment.method].label} · ${
                  PAYMENT_STATUS[o.payment.status].vendorLabel
                }`,
              ]}
              pill={{
                label: orderStatusLabel(o.status, o.fulfilment),
                tone: pillTone(ORDER_STATUS[o.status].tone),
              }}
              amount={formatPKR(o.total)}
              onPress={() => navigation.navigate('AdminFoodOrder', { id: o.id, code: o.code })}
            />
          )}
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
                title={searching ? `No order ${searching}` : s.status || s.vendor ? 'No orders match' : 'No orders yet'}
                body={searching ? "Check the code on the customer's receipt." : s.status || s.vendor ? 'Try another status.' : 'Orders show here as customers place them.'}
              />
            )
          }
          ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
        />
      </ServiceScope>
    </ScreenShell>
  );
};

export default AdminFoodOrdersScreen;
