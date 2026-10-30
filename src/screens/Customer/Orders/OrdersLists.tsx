// ═══════════════════════════════════════════════════════
// MetroMatrix — The order and appointment lists
// ═══════════════════════════════════════════════════════
// Shared by the cross-service Orders screen (from the home's side menu) and
// the services' own tabs: Shopping → Orders, Health → Appointments, Food
// Court → Orders. Shopping orders are grouped by checkout; each card leads
// with what most needs attention. Appointments come Upcoming (soonest first)
// or Past, each with its one action now. Food orders come Active (on their
// way) or Past.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { usePagedList } from '@hooks/usePagedList';
import { getOrdersAPI } from '@networks/shopping/ordersNetwork';
import { getAppointmentsAPI } from '@networks/health/appointmentsNetwork';
import { getFoodOrdersAPI } from '@networks/food/ordersNetwork';
import { orderStatusLabel, ORDER_STATUS, pillTone } from '@models/food/foodStatusModel';
import { useAppointmentAction } from '@components/health/HealthParts';
import { groupHeadline } from '@models/shopping/orderStatusModel';
import { ServiceScope, storePalette, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, AppointmentCard, Card, EmptyState, InlineNotice, SkeletonLines, StatusPill, storeInitials } from '@custom/index';
import type { AppointmentSegment, FoodOrderSummary, OrderGroupSummary, OrderSegment } from '@/types';
import { cdn } from '@utils/cdn';
import { formatDateTime } from '@utils/dates';
import { formatPKR } from '@utils/money';
import { orderGroupSummaryPageSerializer } from '@serializers/shopping/orderSerializer';
import { foodOrdersPageSerializer } from '@serializers/food/orderSerializer';
import { appointmentSummaryPageSerializer } from '@serializers/health/appointmentSerializer';

export const FOOD_SEGMENTS: { key: 'active' | 'past'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'past', label: 'Past' },
];

export const SHOP_SEGMENTS: { key: OrderSegment; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8 },
    list: { gap: space.s12, paddingBottom: space.s40 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    marks: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    mark: {
      width: size.storeLogoSmall,
      height: size.storeLogoSmall,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbs: { flexDirection: 'row', gap: space.s8 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    grow: { flex: 1 },
    logo: { width: size.storeLogoSmall, height: size.storeLogoSmall, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
  });

const OrderGroupCard: React.FC<{ group: OrderGroupSummary; onPress: () => void }> = ({ group, onPress }) => {
  const styles = useStyles(makeStyles);
  const { size, type } = useTheme();
  const head = groupHeadline(group.orders);
  const names = group.stores.length > 1 ? `${group.stores[0].name} and ${group.stores.length - 1} more` : group.stores[0]?.name ?? 'Order';
  return (
    <Card onPress={onPress} accessibilityLabel={`Order ${group.code}, ${names}, ${head.label}, ${formatPKR(group.total)}`}>
      <View style={styles.row}>
        <View style={styles.marks}>
          {group.stores.slice(0, 3).map(st => {
            const p = storePalette(st.brandColor, null);
            return (
              <View key={st.name} style={[styles.mark, { backgroundColor: p.accent }]}>
                <AppText style={[type.micro, { color: p.onAccent }]}>{storeInitials(st.name)}</AppText>
              </View>
            );
          })}
          <AppText variant="title" numberOfLines={1} style={styles.grow}>
            {names}
          </AppText>
        </View>
      </View>
      <View style={styles.thumbs}>
        {group.thumbnails.slice(0, 4).map((uri, i) => (
          <Image key={`${uri}-${i}`} source={{ uri: cdn(uri, { w: size.thumb, h: size.thumb / size.productAspect }) ?? undefined }} style={styles.thumb} contentFit="cover" />
        ))}
      </View>
      <View style={styles.row}>
        <StatusPill label={head.label} tone={head.tone} />
        <AppText variant="bodyStrong">{formatPKR(group.total)}</AppText>
      </View>
      <AppText variant="caption" tone="muted">
        {group.code} · {formatDateTime(group.createdAt)} · {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
      </AppText>
    </Card>
  );
};

export const ShopOrders: React.FC<{ segment: OrderSegment; onOpen: (code: string) => void; onShop: () => void }> = ({ segment, onOpen, onShop }) => {
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => getOrdersAPI(segment, page, size), orderGroupSummaryPageSerializer, `orders|${segment}`);
  return (
    <ServiceScope service="shopping">
      <FlatList
        data={list.rows}
        keyExtractor={g => g.code}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <OrderGroupCard group={item} onPress={() => onOpen(item.code)} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="package"
              title={segment === 'active' ? 'Nothing on its way' : segment === 'completed' ? 'No completed orders yet' : 'No cancelled orders'}
              body={segment === 'active' ? 'Orders you place show here until they arrive.' : 'They’ll show here.'}
              action={segment === 'active' ? { label: 'Start shopping', onPress: onShop } : undefined}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ServiceScope>
  );
};

export const Appointments: React.FC<{ segment: AppointmentSegment; onOpen: (code: string) => void; onFind: () => void }> = ({ segment, onOpen, onFind }) => {
  const styles = useStyles(makeStyles);
  const actionFor = useAppointmentAction();
  const list = usePagedList((page, size) => getAppointmentsAPI(segment, page, size), appointmentSummaryPageSerializer, `appointments|${segment}`);
  return (
    <ServiceScope service="healthcare">
      <FlatList
        data={list.rows}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <AppointmentCard appointment={item} onPress={() => onOpen(item.code)} action={actionFor(item)} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="calendar"
              title={segment === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
              body={segment === 'upcoming' ? 'Book a video consultation or a clinic visit in a few taps.' : 'Visits you’ve had show here, with their prescriptions.'}
              action={segment === 'upcoming' ? { label: 'Find a doctor', onPress: onFind } : undefined}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ServiceScope>
  );
};

const FoodOrderCard: React.FC<{ order: FoodOrderSummary; onPress: () => void }> = ({ order, onPress }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const label = orderStatusLabel(order.status, order.fulfilment);
  return (
    <Card onPress={onPress} accessibilityLabel={`Order ${order.code}, ${order.vendor.name}, ${label}, ${formatPKR(order.total)}`}>
      <View style={styles.row}>
        <View style={styles.marks}>
          {order.vendor.logoUrl ? (
            <Image source={{ uri: cdn(order.vendor.logoUrl, { w: size.storeLogoSmall }) ?? undefined }} style={styles.logo} contentFit="cover" />
          ) : null}
          <AppText variant="title" numberOfLines={1} style={styles.grow}>
            {order.vendor.name}
          </AppText>
        </View>
      </View>
      <View style={styles.row}>
        <StatusPill label={label} tone={pillTone(ORDER_STATUS[order.status].tone)} />
        <AppText variant="bodyStrong">{formatPKR(order.total)}</AppText>
      </View>
      <AppText variant="caption" tone="muted">
        {order.code} · {formatDateTime(order.scheduledFor ?? order.placedAt)} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        {order.fulfilment === 'pickup' ? ' · Pick-up' : ''}
      </AppText>
    </Card>
  );
};

export const FoodOrdersList: React.FC<{ segment: 'active' | 'past'; onOpen: (code: string) => void; onBrowse: () => void }> = ({ segment, onOpen, onBrowse }) => {
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => getFoodOrdersAPI(segment, page, size), foodOrdersPageSerializer, `food-orders|${segment}`);
  return (
    <ServiceScope service="food">
      <FlatList
        data={list.rows}
        keyExtractor={o => o.code}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => <FoodOrderCard order={item} onPress={() => onOpen(item.code)} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="coffee"
              title={segment === 'active' ? 'Nothing on its way' : 'No past Food Court orders'}
              body={segment === 'active' ? 'Orders you place show here until they reach you, with each kitchen’s time.' : 'Delivered, collected and cancelled orders show here.'}
              action={segment === 'active' ? { label: 'Browse the Food Court', onPress: onBrowse } : undefined}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ServiceScope>
  );
};
