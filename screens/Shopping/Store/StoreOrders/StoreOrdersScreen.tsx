// ═══════════════════════════════════════════════════════
// MetroMatrix — The store's orders
// ═══════════════════════════════════════════════════════
// By where they are: New, To pack, To ship, Shipped, Done, Cancelled (with
// counts), or every transfer waiting to be checked. Search by order code or
// customer. Refreshes itself every 30 s while on screen.

import React, { useCallback } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useDebouncedValue, usePagedList } from '../../../../hooks/usePagedList';
import { getPartnerOrdersAPI } from '../../../../networks/shopping/partner/partnerOrdersNetwork';
import { PARTNER_SEGMENTS } from '../../../../models/shopping/orderStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { ChoiceChip, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextField } from '../../../../Custom-Components/index';
import { PartnerOrderRowView } from '../../../../Components/shopping/StoreParts';
import { selectStoreOrders, setStoreOrdersQuery, setStoreOrdersView } from './storeOrdersSlice';
import { partnerOrderPageSerializer } from '../../../../serializers/shopping/partnerSerializer';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { gap: space.s8 },
    list: { paddingBottom: space.s40 },
  });

const StoreOrdersScreen: React.FC = () => (
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
  const q = useDebouncedValue(s.query.trim());
  const payments = s.view === 'payments';
  const list = usePagedList(
    (page, size) =>
      getPartnerOrdersAPI({ segment: s.view === 'payments' ? 'new' : s.view, q: q || undefined, payment: payments ? 'proof_submitted' : undefined }, page, size),
    partnerOrderPageSerializer,
    `store-orders|${s.view}|${q}`,
  );
  const counts = list.first?.segmentCounts ?? null;

  // New orders arrive while the store watches: refresh quietly every 30 s.
  const { poll } = list;
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(poll, motion.ordersPoll);
      return () => clearInterval(t);
    }, [poll, motion.ordersPoll]),
  );

  return (
    <ScreenShell title="Orders" scroll={false}>
      <TextField
        label="Search orders"
        value={s.query}
        onChangeText={t => dispatch(setStoreOrdersQuery(t))}
        icon="search"
        placeholder="Order code or customer"
        clearable
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PARTNER_SEGMENTS.map(sg => (
            <ChoiceChip
              key={sg.key}
              label={counts && counts[sg.key] ? `${sg.label} ${counts[sg.key]}` : sg.label}
              selected={s.view === sg.key}
              onPress={() => dispatch(setStoreOrdersView(sg.key))}
            />
          ))}
          <ChoiceChip label="Payments to check" icon="card-outline" selected={payments} onPress={() => dispatch(setStoreOrdersView('payments'))} />
        </ScrollView>
      </View>
      <FlatList
        data={list.rows}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <PartnerOrderRowView order={item} onPress={() => navigation.navigate('StoreOrderDetail', { id: item.id, code: item.code })} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="inbox"
              title={q ? `No orders match "${q}"` : payments ? 'No payments to check' : 'Nothing here'}
              body={payments ? 'Transfers customers report paying show here.' : 'Orders move here as you work through them.'}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ScreenShell>
  );
};

export default StoreOrdersScreen;
