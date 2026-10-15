// ═══════════════════════════════════════════════════════
// MetroMatrix — Today (the store's first tab)
// ═══════════════════════════════════════════════════════
// What needs doing, as counts you can tap: new orders, orders to ship,
// transfers to check, returns, low stock. Then the week's recorded sales
// and the newest orders. MetroMatrix never holds the store's money.

import React, { useCallback } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  CountIconButton,
  Divider,
  InlineNotice,
  ScreenShell,
  SkeletonLines,
  Sparkline,
  TextAction,
} from '@custom/index';
import { ActionTile, PartnerOrderRowView } from '@components/shopping/StoreParts';
import { formatPKR } from '@utils/money';
import { loadUnreadCountAsync, selectUnreadCount } from '../../../Account/Notifications/notificationsSlice';
import { setStoreOrdersView, type StoreOrdersView } from '../StoreOrders/storeOrdersSlice';
import { loadTodayAsync, resumeStoreAsync, selectStoreToday } from './storeTodaySlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    grid: { gap: space.s12 },
    gridRow: { flexDirection: 'row', gap: space.s12 },
    spacer: { flex: 1 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
  });

const StoreTodayScreen: React.FC = () => (
  <ServiceScope service="shopping">
    <StoreTodayContent />
  </ServiceScope>
);

const StoreTodayContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<Nav>();
  const s = useAppSelector(selectStoreToday);
  const unread = useAppSelector(selectUnreadCount);
  const sum = s.summary;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadTodayAsync({ refresh: false }));
      void dispatch(loadUnreadCountAsync());
    }, [dispatch]),
  );

  const openOrders = (view: StoreOrdersView) => {
    dispatch(setStoreOrdersView(view));
    navigation.navigate('OrdersTab');
  };

  return (
    <ScreenShell
      eyebrow="Today"
      title={sum?.storeName ?? 'Your store'}
      subtitle={sum ? (sum.isPaused ? 'Taking a break: customers can browse but not order.' : 'Open for orders') : undefined}
      headerRight={<CountIconButton icon="notifications-outline" count={unread} onPress={() => navigation.navigate('Notifications')} label="Notifications" />}
      refreshing={s.refreshing}
      onRefresh={() => void dispatch(loadTodayAsync({ refresh: true }))}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadTodayAsync({ refresh: false })) }} /> : null}
      {sum?.isPaused ? (
        <InlineNotice
          tone="warning"
          title="Your store is paused"
          message={sum.pauseMessage ?? 'Customers see that you are taking a break.'}
          action={{ label: s.resuming ? 'Opening…' : 'Open my store again', onPress: () => void dispatch(resumeStoreAsync()) }}
        />
      ) : null}

      {!sum ? (
        <SkeletonLines lines={8} />
      ) : (
        <>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <ActionTile label="New orders" count={sum.counts.newOrders} icon="receipt-outline" onPress={() => openOrders('new')} />
              <ActionTile label="To pack and ship" count={sum.counts.toShip} icon="cube-outline" onPress={() => openOrders('to_pack')} />
            </View>
            <View style={styles.gridRow}>
              <ActionTile label="Payments to check" count={sum.counts.paymentsToConfirm} icon="card-outline" tone="warning" onPress={() => openOrders('payments')} />
              <ActionTile label="Returns" count={sum.counts.returnsOpen} icon="return-down-back-outline" onPress={() => navigation.navigate('StoreReturns')} />
            </View>
            <View style={styles.gridRow}>
              <ActionTile label="Low on stock" count={sum.counts.lowStock} icon="alert-circle-outline" tone="warning" onPress={() => navigation.navigate('Inventory', { lowStock: true })} />
              <View style={styles.spacer} />
            </View>
          </View>

          <Card>
            <AppText variant="small" tone="muted">
              Recorded sales, last 7 days
            </AppText>
            <AppText variant="h1">{formatPKR(sum.recordedSales7d)}</AppText>
            <Sparkline values={sum.sales7d.map(d => d.amount)} accessibilityLabel={`Recorded sales over the last 7 days: ${formatPKR(sum.recordedSales7d)}`} />
            <AppText variant="caption" tone="muted">
              From orders you marked delivered. MetroMatrix does not hold or process your money.
            </AppText>
            <TextAction label="See insights" icon="stats-chart-outline" onPress={() => navigation.navigate('Insights')} />
          </Card>

          <Card>
            <View style={styles.actions}>
              <AppText variant="title">Newest orders</AppText>
              <TextAction label="All orders" onPress={() => openOrders('new')} />
            </View>
            {s.recent.length ? (
              s.recent.map((o, i) => (
                <View key={o.id}>
                  {i > 0 ? <Divider /> : null}
                  <PartnerOrderRowView order={o} onPress={() => navigation.navigate('StoreOrderDetail', { id: o.id, code: o.code })} />
                </View>
              ))
            ) : (
              <AppText variant="body" tone="muted">
                No new orders right now.
              </AppText>
            )}
          </Card>

          <View style={styles.actions}>
            <Button label="Add a product" leftIcon="add" onPress={() => navigation.navigate('ProductForm')} />
            <TextAction
              label="Share your store"
              icon="share-outline"
              onPress={() => void Share.share({ message: `Shop ${sum.storeName} on MetroMatrix: metromatrix://shop/store/${sum.storeSlug}` })}
            />
          </View>
        </>
      )}
    </ScreenShell>
  );
};

export default StoreTodayScreen;
