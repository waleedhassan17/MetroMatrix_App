// ═══════════════════════════════════════════════════════
// MetroMatrix — Orders (Shop · Health · Food)
// ═══════════════════════════════════════════════════════
// One place for everything ordered across the services. Shopping orders are
// grouped by checkout; each card leads with what most needs attention (a
// payment the store is waiting for first). Health lists appointments,
// Upcoming (soonest first) or Past, each with its one action now.

import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { usePagedList } from '@hooks/usePagedList';
import { listOrders } from '@networks/shopping/ordersNetwork';
import { listAppointments } from '@networks/health/appointmentsNetwork';
import { APPOINTMENT_SEGMENTS } from '@models/health/appointmentStatusModel';
import { useAppointmentAction } from '@components/health/HealthParts';
import { groupHeadline } from '@models/shopping/orderStatusModel';
import { ServiceScope, storePalette, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, AppointmentCard, Card, ChoiceChip, EmptyState, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, StatusPill, storeInitials } from '@custom/index';
import type { AppointmentSegment, OrderGroupSummary, OrderSegment, OrdersStackParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { formatDateTime } from '@utils/dates';
import { formatPKR } from '@utils/money';
import { selectOrdersView, setOrdersSegment, setOrdersService, setVisitsSegment, type OrdersService } from './ordersSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'Orders'>;

const SERVICES: { key: OrdersService; label: string }[] = [
  { key: 'shop', label: 'Shop' },
  { key: 'health', label: 'Health' },
  { key: 'food', label: 'Food' },
];
const SEGMENTS: { key: OrderSegment; label: string }[] = [
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

const ShopOrders: React.FC<{ segment: OrderSegment; onOpen: (code: string) => void; onShop: () => void }> = ({ segment, onOpen, onShop }) => {
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => listOrders(segment, page, size), `orders|${segment}`);
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

const Appointments: React.FC<{ segment: AppointmentSegment; onOpen: (code: string) => void; onFind: () => void }> = ({ segment, onOpen, onFind }) => {
  const styles = useStyles(makeStyles);
  const actionFor = useAppointmentAction();
  const list = usePagedList((page, size) => listAppointments(segment, page, size), `appointments|${segment}`);
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

const OrdersScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const v = useAppSelector(selectOrdersView);
  const asked = route.params?.segment;
  const askedService = route.params?.service;
  const askedVisits = route.params?.visits;

  useEffect(() => {
    if (asked) {
      dispatch(setOrdersService('shop'));
      dispatch(setOrdersSegment(asked));
    }
  }, [asked, dispatch]);

  useEffect(() => {
    if (askedService) dispatch(setOrdersService(askedService));
    if (askedVisits) dispatch(setVisitsSegment(askedVisits));
  }, [askedService, askedVisits, dispatch]);

  const home = (screen: string) => (navigation.getParent() as unknown as { navigate: (n: string, p?: object) => void } | undefined)?.navigate('HomeTab', { screen, initial: false });
  const toShop = () => home('ShoppingHome');

  return (
    <ScreenShell title="Orders" scroll={false}>
      <SegmentTabs options={SERVICES} value={v.service} onChange={k => dispatch(setOrdersService(k))} accessibilityLabel="Service" />
      {v.service === 'shop' ? (
        <>
          <View style={styles.chips}>
            {SEGMENTS.map(sg => (
              <ChoiceChip key={sg.key} label={sg.label} selected={v.segment === sg.key} onPress={() => dispatch(setOrdersSegment(sg.key))} />
            ))}
          </View>
          <ShopOrders segment={v.segment} onOpen={groupCode => navigation.navigate('OrderDetail', { groupCode })} onShop={toShop} />
        </>
      ) : v.service === 'health' ? (
        <>
          <View style={styles.chips}>
            {APPOINTMENT_SEGMENTS.map(sg => (
              <ChoiceChip key={sg.key} label={sg.label} selected={v.visits === sg.key} onPress={() => dispatch(setVisitsSegment(sg.key))} />
            ))}
          </View>
          <Appointments segment={v.visits} onOpen={code => navigation.navigate('AppointmentDetail', { code })} onFind={() => home('HealthHome')} />
        </>
      ) : (
        <EmptyState icon="coffee" title="No Food Court orders yet" body="Orders from the Food Court's vendors will show here." />
      )}
    </ScreenShell>
  );
};

export default OrdersScreen;
