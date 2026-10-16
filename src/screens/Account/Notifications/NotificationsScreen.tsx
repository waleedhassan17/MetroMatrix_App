// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications (customer and store partner)
// ═══════════════════════════════════════════════════════
// Newest first, unread marked. A tap marks it read and opens what it is
// about: for a customer the order (or product); for a store the order, the
// return or the product.

import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { usePagedList } from '@hooks/usePagedList';
import { listNotifications } from '@networks/notifications/notificationsNetwork';
import { PageHeaderScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Divider, EmptyState, IconButton, InlineNotice, IonIcon, ScreenShell, SkeletonLines, type IonName } from '@custom/index';
import type { AppNotification, NotificationType, ShopBrowseParamList } from '@/types';
import { formatDay } from '@utils/dates';
import { selectUser } from '../../Auth/authSlice';
import { loadUnreadCountAsync, markReadAsync, selectUnreadCount } from './notificationsSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'Notifications'>;

const ICON: Record<NotificationType, IonName> = {
  order_placed: 'bag-check-outline',
  order_update: 'cube-outline',
  payment_update: 'wallet-outline',
  return_update: 'return-down-back-outline',
  review_reply: 'chatbubble-ellipses-outline',
  new_order: 'receipt-outline',
  payment_proof: 'card-outline',
  return_requested: 'return-down-back-outline',
  low_stock: 'alert-circle-outline',
  appointment_update: 'calendar-outline',
  appointment_reminder: 'alarm-outline',
  appointment_new: 'calendar-number-outline',
  appointment_payment: 'card-outline',
  prescription_ready: 'document-text-outline',
};

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s16 },
    icon: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: space.s4 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    dot: { width: size.pageDot, height: size.pageDot, borderRadius: radius.pill },
    list: { paddingBottom: space.s40 },
  });

type Nav = { navigate: (name: string, params?: object) => void; push: (name: string, params?: object) => void };

const NotificationsScreen: React.FC<Props> = props => (
  <PageHeaderScope>
    <NotificationsContent {...props} />
  </PageHeaderScope>
);

const NotificationsContent: React.FC<Props> = ({ navigation }) => {
  const { back, canGoBack } = useBack();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  const user = useAppSelector(selectUser);
  const unread = useAppSelector(selectUnreadCount);
  const list = usePagedList((page, size) => listNotifications(page, size), 'notifications');
  const isStore = user?.role === 'partner';

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadUnreadCountAsync());
    }, [dispatch]),
  );

  const open = (n: AppNotification) => {
    if (!n.isRead) {
      void dispatch(markReadAsync({ ids: [n.id] }));
      list.setRows(rows => rows.map(r => (r.id === n.id ? { ...r, isRead: true } : r)));
    }
    const nav = navigation as unknown as Nav;
    const d = n.data;
    if (isStore) {
      if (d.appointmentId) nav.navigate('DoctorAppointment', { id: d.appointmentId });
      else if (d.returnId) nav.navigate('StoreReturnDetail', { id: d.returnId });
      else if (d.orderId) nav.navigate('StoreOrderDetail', { id: d.orderId });
      else if (d.productId) nav.navigate('ProductForm', { id: d.productId });
      return;
    }
    if (d.prescriptionId) nav.push('PrescriptionView', { id: d.prescriptionId });
    else if (d.appointmentCode) nav.navigate('OrdersTab', { screen: 'AppointmentDetail', params: { code: d.appointmentCode }, initial: false });
    else if (d.groupCode) nav.navigate('OrdersTab', { screen: 'OrderDetail', params: { groupCode: d.groupCode }, initial: false });
    else if (d.productId) nav.push('ProductDetail', { id: d.productId });
  };

  const markAll = () => {
    void dispatch(markReadAsync({ all: true }));
    list.setRows(rows => rows.map(r => ({ ...r, isRead: true })));
  };

  return (
    <ScreenShell
      title="Notifications"
      onBack={canGoBack ? back : undefined}
      headerRight={unread > 0 ? <IconButton icon="checkmark-done-outline" onPress={markAll} accessibilityLabel="Mark all as read" /> : undefined}
      scroll={false}>
      <FlatList
        data={list.rows}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => open(n)}
            style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="button"
            accessibilityLabel={`${n.isRead ? '' : 'Unread. '}${n.title}. ${n.body}`}>
            <View style={[styles.icon, { backgroundColor: n.isRead ? colors.surfaceSunk : service.accentSoft }]}>
              <IonIcon name={ICON[n.type] ?? 'notifications-outline'} size="md" color={n.isRead ? colors.inkMuted : service.accentDeep} />
            </View>
            <View style={styles.text}>
              <View style={styles.head}>
                {!n.isRead ? <View style={[styles.dot, { backgroundColor: service.accent }]} /> : null}
                <AppText variant={n.isRead ? 'body' : 'bodyStrong'} style={styles.text} numberOfLines={2}>
                  {n.title}
                </AppText>
              </View>
              {n.body ? (
                <AppText variant="small" tone="muted" numberOfLines={3}>
                  {n.body}
                </AppText>
              ) : null}
              <AppText variant="caption" tone="faint">
                {formatDay(n.createdAt)}
              </AppText>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="bell" title="You’re all caught up" body={isStore ? 'New orders, payments and returns show here.' : 'Order updates and replies show here.'} />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ScreenShell>
  );
};

export default NotificationsScreen;
