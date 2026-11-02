// ═══════════════════════════════════════════════════════
// MetroMatrix — The store's orders
// ═══════════════════════════════════════════════════════
// By where they are: New, To pack, To ship, Shipped, Done, Cancelled, or
// every transfer waiting to be checked and refund to record (the dashboard's
// counts on the chips). The search and the chips sit in the header; each
// order is a raised card with ONE pill. Refreshes itself every 30 s while on
// screen, and refreshes the Orders tab's count when it opens.

import React, { useCallback } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { fetchPartnerOrders } from '../../networks/shopping/partner/partnerOrders';
import { PARTNER_SEGMENTS } from '../../models/shopping/orderStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { ChoiceChip, EmptyState, InlineNotice, RowCardSkeleton, RowCardsSkeleton, ScreenShell } from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import { PartnerOrderCard } from '../../Components/shopping/StoreParts';
import { loadTodayAsync, selectStoreToday } from '../store-today-screen/storeTodaySlice';
import { selectStoreOrders, setStoreOrdersQuery, setStoreOrdersView, type StoreOrdersView } from './storeOrdersSlice';
import { partnerOrderPageSerializer } from '../../serializers/shopping/partnerSerializer';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    // The chips run edge to edge under the field.
    chipRail: { marginHorizontal: -gutter },
    chips: { gap: space.s8, paddingHorizontal: gutter },
    list: { paddingBottom: space.s40 },
    gap: { height: space.s12 },
    footer: { paddingTop: space.s12 },
  });

const StoreOrders: React.FC = () => (
  <ServiceScope service="shopping">
    <StoreOrdersContent />
  </ServiceScope>
);

const StoreOrdersContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { motion } = useTheme();
  const navigation = useNavigation<Nav>();
  const s = useAppSelector(selectStoreOrders);
  const counts = useAppSelector(selectStoreToday).summary?.counts;
  const q = useDebouncedValue(s.query.trim());
  const payments = s.view === 'payments';
  const refunds = s.view === 'refunds';
  const list = usePagedList(
    (page, size) =>
      fetchPartnerOrders(
        s.view === 'payments' || s.view === 'refunds'
          ? { paymentStatus: s.view === 'payments' ? 'proof_submitted' : 'refund_due', q: q || undefined }
          : { segment: s.view, q: q || undefined },
        page,
        size,
      ),
    partnerOrderPageSerializer,
    `store-orders|${s.view}|${q}`,
  );

  // New orders arrive while the store watches: refresh quietly every 30 s.
  const { poll } = list;
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadTodayAsync({ refresh: false }));
      const t = setInterval(poll, motion.ordersPoll);
      return () => clearInterval(t);
    }, [poll, motion.ordersPoll, dispatch]),
  );

  const chip = (view: StoreOrdersView, label: string, count?: number) => (
    <ChoiceChip key={view} label={label} count={count} selected={s.view === view} onPress={() => dispatch(setStoreOrdersView(view))} />
  );
  const segment = (key: string) => PARTNER_SEGMENTS.find(sg => sg.key === key)?.label ?? key;

  return (
    <ScreenShell
      title="Orders"
      subtitle={counts ? `${counts.newOrders} new · ${counts.toShip} to ship` : undefined}
      scroll={false}
      headerContent={
        <>
          <SearchField value={s.query} onChange={t => dispatch(setStoreOrdersQuery(t))} placeholder="Order code or customer" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.chips}>
            {chip('new', segment('new'), counts?.newOrders)}
            {chip('payments', 'Payments to check', counts?.paymentsToConfirm)}
            {chip('to_pack', segment('to_pack'))}
            {chip('to_ship', segment('to_ship'), counts?.toShip)}
            {chip('refunds', 'Refunds to record', counts?.refundsDue)}
            {PARTNER_SEGMENTS.filter(sg => !['new', 'to_pack', 'to_ship'].includes(sg.key)).map(sg => chip(sg.key, sg.label))}
          </ScrollView>
        </>
      }>
      <FlatList
        data={list.rows}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <PartnerOrderCard order={item} onPress={() => navigation.navigate('StoreOrderDetail', { id: item.id, code: item.code })} />}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              ion="receipt-outline"
              title={q ? `No orders match "${q}"` : payments ? 'No payments to check' : refunds ? 'No refunds to record' : 'Nothing here'}
              body={
                payments
                  ? 'Transfers customers report paying show here.'
                  : refunds
                    ? 'A paid order that is cancelled shows here until you note the refund you sent.'
                    : 'Orders move here as you work through them.'
              }
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

export default StoreOrders;
