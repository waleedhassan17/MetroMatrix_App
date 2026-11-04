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
import { usePagedList } from '../../hooks/usePagedList';
import { fetchOrders } from '../../networks/shopping/orders';
import { fetchAppointments } from '../../networks/health/appointments';
import { fetchFoodOrders } from '../../networks/food/orders';
import { FoodOrderRow } from '../../Components/food/FoodParts';
import { useAppointmentAction } from '../../Components/health/HealthParts';
import { groupHeadline } from '../../models/shopping/orderStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  AppointmentCard,
  Card,
  Divider,
  EmptyState,
  InlineNotice,
  IonIcon,
  OrderCardSkeleton,
  SkeletonLines,
  StatusPill,
  StoreMark,
} from '../../Custom-Components/index';
import type { AppointmentSegment, OrderGroupSummary, OrderSegment } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDateTime } from '../../utils/dates/dates';
import { formatPKR } from '../../utils/money/money';
import { orderGroupSummaryPageSerializer } from '../../serializers/shopping/orderSerializer';
import { foodOrdersPageSerializer } from '../../serializers/food/orderSerializer';
import { appointmentSummaryPageSerializer } from '../../serializers/health/appointmentSerializer';

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
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    marks: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    logo: { width: size.storeLogoSmall, height: size.storeLogoSmall, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    stack: { flexDirection: 'row', alignItems: 'center' },
    // Overlapping store marks, each in a white ring (the FYP's avatar stack).
    mark: { borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: colors.surface },
    markOverlap: { marginLeft: -space.s8 },
    thumbs: { flexDirection: 'row', gap: space.s8 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    more: { alignItems: 'center', justifyContent: 'center' },
    grow: { flex: 1 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  });

/** How many photos an order card shows before "+N". */
const ORDER_THUMBS = 3;

const OrderGroupCard: React.FC<{ group: OrderGroupSummary; onPress: () => void }> = ({ group, onPress }) => {
  const styles = useStyles(makeStyles);
  const { size, colors } = useTheme();
  const head = groupHeadline(group.orders);
  const names = group.stores.length > 1 ? `${group.stores[0].name} and ${group.stores.length - 1} more` : group.stores[0]?.name ?? 'Order';
  const shown = group.thumbnails.slice(0, ORDER_THUMBS);
  const extra = group.itemCount - shown.length;
  return (
    <Card onPress={onPress} accessibilityLabel={`Order ${group.code}, ${names}, ${head.label}, ${formatPKR(group.total)}`}>
      <View style={styles.head}>
        <View style={styles.stack}>
          {group.stores.slice(0, 3).map((st, i) => (
            <View key={st.name} style={[styles.mark, i > 0 && styles.markOverlap]}>
              <StoreMark store={st} size="sm" />
            </View>
          ))}
        </View>
        <AppText variant="title" numberOfLines={1} style={styles.grow}>
          {names}
        </AppText>
        <StatusPill label={head.label} tone={head.tone} />
      </View>
      {shown.length ? (
        <View style={styles.thumbs}>
          {shown.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri: cdn(uri, { w: size.thumb * 2, h: (size.thumb * 2) / size.productAspect }) ?? undefined }}
              style={styles.thumb}
              contentFit="cover"
            />
          ))}
          {extra > 0 ? (
            <View style={[styles.thumb, styles.more]}>
              <AppText variant="bodyStrong" tone="muted">
                +{extra}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <Divider />
      <View style={styles.foot}>
        <AppText variant="small" tone="muted" numberOfLines={1} style={styles.grow}>
          {group.code} · {formatDateTime(group.createdAt)} · {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
        </AppText>
        <AppText variant="bodyStrong">{formatPKR(group.total)}</AppText>
        <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
      </View>
    </Card>
  );
};

export const ShopOrders: React.FC<{ segment: OrderSegment; onOpen: (code: string) => void; onShop: () => void }> = ({ segment, onOpen, onShop }) => {
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => fetchOrders(segment, page, size), orderGroupSummaryPageSerializer, `orders|${segment}`);
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
            <View style={styles.list}>
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </View>
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              ion="receipt-outline"
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
  const list = usePagedList((page, size) => fetchAppointments(segment, page, size), appointmentSummaryPageSerializer, `appointments|${segment}`);
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

export const FoodOrdersList: React.FC<{ segment: 'active' | 'past'; onOpen: (code: string) => void; onBrowse: () => void; header?: React.ReactElement | null; bottomInset?: number }> = ({
  segment,
  onOpen,
  onBrowse,
  header,
  bottomInset = 0,
}) => {
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => fetchFoodOrders(segment, page, size), foodOrdersPageSerializer, `food-orders|${segment}`);
  return (
    <ServiceScope service="food">
      <FlatList
        data={list.rows}
        keyExtractor={o => o.code}
        contentContainerStyle={[styles.list, bottomInset ? { paddingBottom: bottomInset } : null]}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        ListHeaderComponent={header ?? null}
        renderItem={({ item }) => <FoodOrderRow order={item} when={formatDateTime(item.scheduledFor ?? item.placedAt)} onPress={() => onOpen(item.code)} />}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={styles.list}>
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </View>
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              ion="receipt-outline"
              title={segment === 'active' ? 'Nothing on its way' : 'No past Food Court orders'}
              body={segment === 'active' ? 'Orders you place show here until they reach you, with each kitchen’s time.' : 'Delivered, collected and cancelled orders show here.'}
              action={segment === 'active' ? { label: 'Browse the Food Court', onPress: onBrowse } : undefined}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <OrderCardSkeleton /> : null}
      />
    </ServiceScope>
  );
};
