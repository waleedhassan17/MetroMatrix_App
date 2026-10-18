// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: find a Food Court order
// ═══════════════════════════════════════════════════════
// For disputes: an order by its FC- code, or a vendor's orders, newest
// first. Read-only: staff see every event, but the vendor and customer act.

import React, { useEffect } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue, usePagedList } from '@hooks/usePagedList';
import { listAdminFoodOrders } from '@networks/admin/adminFoodNetwork';
import { ORDER_STATUS, PAYMENT_STATUS, pillTone } from '@models/food/foodStatusModel';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, ChoiceChip, Divider, EmptyState, IonIcon, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextField } from '@custom/index';
import type { AdminFoodStackParamList, FoodOrderStatus } from '@/types';
import { formatDateTime } from '@utils/dates';
import { formatPKR } from '@utils/money';
import { selectAdminFoodOrders, setFoodOrderCode, setFoodOrdersStatus, setFoodOrdersVendor } from './adminFoodOrdersSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodOrders'>;

const STATUSES: (FoodOrderStatus | null)[] = [null, 'placed', 'preparing', 'on_the_way', 'delivered', 'cancelled', 'rejected', 'auto_rejected'];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    list: { paddingBottom: space.s40 },
  });

const AdminFoodOrdersScreen: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectAdminFoodOrders);
  const code = useDebouncedValue(s.code.trim());
  const list = usePagedList(
    (page, size) => listAdminFoodOrders({ code: code.length >= 4 ? code : undefined, vendorId: s.vendor?.id, status: s.status ?? undefined }, page, size),
    `admin-food-orders|${code.length >= 4 ? code : ''}|${s.vendor?.id}|${s.status}`,
  );

  // A vendor's "All orders" link narrows the list to it.
  useEffect(() => {
    if (route.params?.vendorId) dispatch(setFoodOrdersVendor({ id: route.params.vendorId, name: route.params.name ?? null }));
    if (route.params?.code) dispatch(setFoodOrderCode(route.params.code));
  }, [dispatch, route.params?.vendorId, route.params?.name, route.params?.code]);

  return (
    <ScreenShell title="Find an order" subtitle="Food Court" onBack={back} scroll={false}>
      <TextField label="Order code" value={s.code} onChangeText={t => dispatch(setFoodOrderCode(t))} icon="search" placeholder="FC-7KQ2PX" autoCapitalize="characters" clearable />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {s.vendor ? <ChoiceChip label={`Only ${s.vendor.name ?? 'this vendor'}`} icon="close" selected onPress={() => dispatch(setFoodOrdersVendor(null))} /> : null}
        {STATUSES.map(st => (
          <ChoiceChip key={st ?? 'all'} label={st ? ORDER_STATUS[st].label : 'Any status'} selected={s.status === st} onPress={() => dispatch(setFoodOrdersStatus(st))} />
        ))}
      </ScrollView>
      <FlatList
        data={list.rows}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        renderItem={({ item: o }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('AdminFoodOrder', { id: o.id, code: o.code })} accessibilityRole="button" accessibilityLabel={`Order ${o.code}, ${ORDER_STATUS[o.status].label}, ${formatPKR(o.total)}`}>
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{o.code}</AppText>
              <AppText variant="small" tone="muted" numberOfLines={1}>
                {[o.customerName, o.itemsSummary].filter(Boolean).join(' · ')}
              </AppText>
              <AppText variant="caption" tone="muted">
                {`${ORDER_STATUS[o.status].label} · ${formatDateTime(o.placedAt)}`}
              </AppText>
            </View>
            <View>
              <AppText variant="bodyStrong">{formatPKR(o.total)}</AppText>
              <StatusPill label={PAYMENT_STATUS[o.payment.status].vendorLabel} tone={pillTone(PAYMENT_STATUS[o.payment.status].tone)} />
            </View>
            <IonIcon name="chevron-forward" size="sm" color={colors.inkFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="search" title={code ? `No order ${code}` : 'No orders match'} body="Check the code on the customer's receipt." />
          )
        }
      />
    </ScreenShell>
  );
};

export default AdminFoodOrdersScreen;
