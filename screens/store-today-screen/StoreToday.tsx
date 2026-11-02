// ═══════════════════════════════════════════════════════
// MetroMatrix — Today (the store's first tab, its dashboard)
// ═══════════════════════════════════════════════════════
// The FYP's brand dashboard, on the gradient header with the store's mark:
// what needs doing now as three tiles you can tap (new orders, to ship,
// transfers to check), the quick actions, the week's recorded sales as bars
// (the best day in the full accent), the newest orders, and what else needs
// you (low stock, returns, refunds to record), each with its count.
// MetroMatrix never holds the store's money.

import React, { useCallback } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  BarChart,
  Card,
  CountIconButton,
  Divider,
  EmptyState,
  InlineNotice,
  ListRow,
  RowCardsSkeleton,
  ScreenShell,
  StatGridSkeleton,
  StoreMark,
  TextAction,
} from '../../Custom-Components/index';
import { QuickActionGrid, StatGrid } from '../../Components/admin/AdminParts';
import { ShopSection } from '../../Components/shopping/ShopParts';
import { PartnerOrderLine } from '../../Components/shopping/StoreParts';
import { formatPKR } from '../../utils/money/money';
import { loadUnreadCountAsync, selectUnreadCount } from '../notifications-screen/notificationsSlice';
import { setStoreOrdersView, type StoreOrdersView } from '../store-orders-screen/storeOrdersSlice';
import { loadTodayAsync, resumeStoreAsync, selectStoreToday } from './storeTodaySlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12 },
    // The store's mark on the gradient, in a soft white ring.
    mark: { borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: colors.onScrimLine },
    salesHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.s12 },
    salesText: { flex: 1, gap: space.s4 },
  });

const StoreToday: React.FC = () => (
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
  const share = () =>
    sum && void Share.share({ message: `Shop ${sum.storeName} on MetroMatrix: metromatrix://shop/store/${sum.storeSlug}` });

  return (
    <ScreenShell
      title={sum?.storeName ?? 'Your store'}
      subtitle={`Dashboard${sum ? ` · ${sum.isPaused ? 'Taking a break' : 'Open for orders'}` : ''}`}
      headerLeading={
        sum ? (
          <View style={styles.mark}>
            <StoreMark store={{ name: sum.storeName, logoUrl: sum.logoUrl, brandColor: sum.brandColor, onBrandColor: sum.onBrandColor }} size="md" />
          </View>
        ) : null
      }
      headerRight={<CountIconButton icon="notifications-outline" count={unread} onPress={() => navigation.navigate('Notifications')} label="Notifications" />}
      refreshing={s.refreshing}
      onRefresh={() => void dispatch(loadTodayAsync({ refresh: true }))}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadTodayAsync({ refresh: false })) }} /> : null}
      {sum?.isPaused ? (
        <InlineNotice
          tone="warning"
          title="Your store is paused"
          message={sum.pauseMessage ?? 'Customers can browse, but not order, until you open again.'}
          action={{ label: s.resuming ? 'Opening…' : 'Open my store again', onPress: () => void dispatch(resumeStoreAsync()) }}
        />
      ) : null}

      {!sum ? (
        <>
          <StatGridSkeleton />
          <RowCardsSkeleton count={2} />
        </>
      ) : (
        <>
          <StatGrid
            columns={3}
            compact
            stats={[
              { key: 'new', icon: 'receipt-outline', tint: 'accent', value: sum.counts.newOrders, label: 'New orders', onPress: () => openOrders('new') },
              { key: 'ship', icon: 'cube-outline', tint: 'blue', value: sum.counts.toShip, label: 'To ship', onPress: () => openOrders('to_pack') },
              { key: 'pay', icon: 'card-outline', tint: 'amber', value: sum.counts.paymentsToConfirm, label: 'Payments to check', onPress: () => openOrders('payments') },
            ]}
          />

          <View style={styles.section}>
            <ShopSection title="Quick actions" inset={false} />
            <QuickActionGrid
              actions={[
                { key: 'add', icon: 'add-circle-outline', tint: 'accent', label: 'Add product', onPress: () => navigation.navigate('ProductForm') },
                { key: 'stock', icon: 'layers-outline', tint: 'blue', label: 'Inventory', onPress: () => navigation.navigate('Inventory') },
                { key: 'coupons', icon: 'pricetag-outline', tint: 'rose', label: 'Coupons', onPress: () => navigation.navigate('Coupons') },
                { key: 'collections', icon: 'albums-outline', tint: 'violet', label: 'Collections', onPress: () => navigation.navigate('Collections') },
                { key: 'insights', icon: 'stats-chart-outline', tint: 'amber', label: 'Insights', onPress: () => navigation.navigate('Insights') },
                { key: 'share', icon: 'share-social-outline', tint: 'grey', label: 'Share store', onPress: share },
              ]}
            />
          </View>

          <Card>
            <View style={styles.salesHead}>
              <View style={styles.salesText}>
                <AppText variant="small" tone="muted">
                  Recorded sales · last 7 days
                </AppText>
                <AppText variant="h1">{formatPKR(sum.recordedSales7d)}</AppText>
              </View>
              <TextAction label="Insights" icon="stats-chart-outline" onPress={() => navigation.navigate('Insights')} />
            </View>
            <BarChart data={sum.sales7d.map(d => ({ label: dayjs(d.date).format('ddd'), value: d.amount }))} format={formatPKR} />
            <AppText variant="caption" tone="muted">
              From orders you marked delivered. MetroMatrix does not hold or process your money.
            </AppText>
          </Card>

          <View style={styles.section}>
            <ShopSection title="New orders" inset={false} onSeeAll={() => openOrders('new')} />
            <Card padded={s.recent.length ? 'horizontal' : true}>
              {s.recent.length ? (
                s.recent.map((o, i) => (
                  <React.Fragment key={o.id}>
                    {i > 0 ? <Divider /> : null}
                    <PartnerOrderLine order={o} onPress={() => navigation.navigate('StoreOrderDetail', { id: o.id, code: o.code })} />
                  </React.Fragment>
                ))
              ) : (
                <EmptyState ion="receipt-outline" title="No new orders right now" body="New orders show here the moment they're placed." />
              )}
            </Card>
          </View>

          <View style={styles.section}>
            <ShopSection title="Needs you" inset={false} />
            <Card padded="horizontal">
              <ListRow
                title="Low on stock"
                subtitle="Variants running out"
                leftIcon="alert-circle-outline"
                tint="red"
                value={String(sum.counts.lowStock)}
                onPress={() => navigation.navigate('Inventory', { lowStock: true })}
              />
              <Divider />
              <ListRow
                title="Return requests"
                subtitle="Customers waiting for your answer"
                leftIcon="return-down-back-outline"
                tint="rose"
                value={String(sum.counts.returnsOpen)}
                onPress={() => navigation.navigate('StoreReturns')}
              />
              <Divider />
              <ListRow
                title="Refunds to record"
                subtitle="Money you owe back"
                leftIcon="cash-outline"
                tint="amber"
                value={String(sum.counts.refundsDue)}
                onPress={() => openOrders('refunds')}
              />
            </Card>
          </View>
        </>
      )}
    </ScreenShell>
  );
};

export default StoreToday;
