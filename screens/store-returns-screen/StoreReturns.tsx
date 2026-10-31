// ═══════════════════════════════════════════════════════
// MetroMatrix — Returns (the store's side)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchPartnerReturns } from '../../networks/shopping/partner/partnerReturns';
import { RETURN_STATUS } from '../../models/shopping/orderStatusModel';
import { returnReasonLabel } from '../../models/shopping/returnFormModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Divider, EmptyState, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, StatusPill } from '../../Custom-Components/index';
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
    row: { paddingVertical: space.s16, gap: space.s4 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    list: { paddingBottom: space.s40 },
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
  const { opacity } = useTheme();
  const s = useAppSelector(selectStoreReturns);
  const list = usePagedList((page, size) => fetchPartnerReturns(s.view === 'all' ? null : s.view, page, size), returnPageSerializer, `store-returns|${s.view}`);

  return (
    <ScreenShell title="Returns" onBack={back} scroll={false}>
      <SegmentTabs
        options={VIEWS}
        value={s.view}
        onChange={k => dispatch(setReturnsView(k))}
      />
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item: r }) => {
          const st = RETURN_STATUS[r.status];
          return (
            <Pressable
              onPress={() => navigation.navigate('StoreReturnDetail', { id: r.id })}
              style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
              accessibilityRole="button"
              accessibilityLabel={`Return on ${r.orderCode} from ${r.customerName}, ${st.label}`}>
              <View style={styles.head}>
                <AppText variant="title">{r.orderCode}</AppText>
                <StatusPill label={st.label} tone={st.tone} />
              </View>
              <AppText variant="small" tone="muted">
                {r.customerName} · {returnReasonLabel(r.reason)} · {r.items.reduce((n, i) => n + i.quantity, 0)} item(s) · {formatDay(r.createdAt)}
              </AppText>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={5} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="rotate-ccw" title={s.view === 'all' ? 'No returns yet' : 'Nothing here'} body="When a customer asks to return something, it shows here." />
          )
        }
      />
    </ScreenShell>
  );
};

export default StoreReturns;
