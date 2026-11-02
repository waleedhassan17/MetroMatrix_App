// ═══════════════════════════════════════════════════════
// MetroMatrix — Returns (the store's side)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchPartnerReturns } from '../../networks/shopping/partner/partnerReturns';
import { RETURN_STATUS } from '../../models/shopping/orderStatusModel';
import { returnReasonLabel } from '../../models/shopping/returnFormModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { EmptyState, InlineNotice, RowCardsSkeleton, ScreenShell, SegmentTabs } from '../../Custom-Components/index';
import { RowCard } from '../../Components/admin/AdminParts';
import type { StorePartnerStackParamList } from '../../models';
import { formatDay } from '../../utils/dates/dates';
import { selectStoreReturns, setReturnsView, type StoreReturnsView } from './storeReturnsSlice';
import { returnPageSerializer } from '../../serializers/shopping/orderSerializer';

/** The open states one at a time (the API filters by one status), then every return. */
const VIEWS: { key: StoreReturnsView; label: string }[] = [
  { key: 'requested', label: 'New' },
  { key: 'approved', label: 'On the way' },
  { key: 'received', label: 'To refund' },
  { key: 'all', label: 'All' },
];

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'StoreReturns'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40 },
    gap: { height: space.s12 },
  });

const StoreReturns: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreReturnsContent {...props} />
  </ServiceScope>
);

const StoreReturnsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectStoreReturns);
  const list = usePagedList((page, size) => fetchPartnerReturns(s.view === 'all' ? null : s.view, page, size), returnPageSerializer, `store-returns|${s.view}`);

  return (
    <ScreenShell
      title="Returns"
      subtitle="Requests, parcels on the way, refunds"
      onBack={back}
      scroll={false}
      headerContent={<SegmentTabs options={VIEWS} value={s.view} onChange={k => dispatch(setReturnsView(k))} accessibilityLabel="Returns" />}>
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item: r }) => {
          const st = RETURN_STATUS[r.status];
          const items = r.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <RowCard
              mark={{ name: r.customerName }}
              title={r.customerName}
              lines={[`${r.orderCode} · ${formatDay(r.createdAt)}`]}
              pill={{ label: st.label, tone: st.tone }}
              foot={{ left: `${items} ${items === 1 ? 'item' : 'items'} · ${returnReasonLabel(r.reason)}` }}
              onPress={() => navigation.navigate('StoreReturnDetail', { id: r.id })}
            />
          );
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState ion="return-down-back-outline" title={s.view === 'all' ? 'No returns yet' : 'Nothing here'} body="When a customer asks to return something, it shows here." />
          )
        }
      />
    </ScreenShell>
  );
};

export default StoreReturns;
