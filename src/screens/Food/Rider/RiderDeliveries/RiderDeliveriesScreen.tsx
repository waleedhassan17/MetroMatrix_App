// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Deliveries
// ═══════════════════════════════════════════════════════
// The duty switch first: on duty, the vendor can give the rider deliveries
// and sees where they are (the phone asks for location after a plain
// explanation); off duty, nothing is shared. Then the deliveries being
// worked now — each opens its page — and past ones, and the vendor they
// deliver for. Live: any change to a delivery reads them again.

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useRiderChannel } from '@hooks/useFoodLive';
import { usePagedList } from '@hooks/usePagedList';
import { getRiderOrdersAPI } from '@networks/food/rider/riderNetwork';
import { placeLine, riderVehicleLabel } from '@models/food/vendorModel';
import { dropOrderLabel } from '@models/kitchen/reachModel';
import { riderStepLabel } from '@models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Avatar, Button, Card, ChoiceChip, Divider, EmptyState, InlineNotice, IonIcon, ListRow, ScreenShell, Sheet, SkeletonLines, StatusPill, ToggleRow } from '@custom/index';
import type { RiderOrder } from '@/types';
import { riderLocation, supportsBackgroundTracking, type RiderLocationState } from '@/services/location/riderLocation';
import { riderTransport } from '@/services/location/riderTransport';
import { callNumber } from '@utils/maps';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { loadRiderDeliveriesAsync, loadRiderHomeAsync, selectRiderHome, setDutyAsync } from './riderHomeSlice';
import { riderOrdersPageSerializer } from '@serializers/food/riderSerializer';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s12 },
    head: { gap: space.s12 },
    vendor: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    route: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const TRACKING_LINE: Record<RiderLocationState['mode'], string | null> = {
  off: null,
  background: 'Sharing your location, even with the app closed.',
  foreground: 'Sharing your location while this app is open. Keep it open on deliveries.',
  denied: null,
  disabled: 'Location sharing is switched off for now.',
};

const DeliveryCard: React.FC<{ o: RiderOrder; onPress: () => void }> = ({ o, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Delivery ${o.code}, ${riderStepLabel(o.riderStep ?? 'assigned', 'rider')}${o.dropOrder ? `, ${dropOrderLabel(o.dropOrder)}` : ''}, from ${o.pickup.name} to ${o.drop?.area ?? 'the customer'}`}>
      <View style={styles.row}>
        <AppText variant="title">{o.code}</AppText>
        {o.dropOrder ? <StatusPill label={dropOrderLabel(o.dropOrder)!} tone="neutral" /> : null}
        <StatusPill label={o.status === 'ready' && (o.riderStep === 'assigned' || o.riderStep === 'accepted_by_rider' || o.riderStep === 'arrived_at_branch') ? 'Ready to collect' : riderStepLabel(o.riderStep ?? 'assigned', 'rider')} tone="accent" />
      </View>
      <View style={styles.route}>
        <IonIcon name="storefront-outline" size="sm" color={colors.inkMuted} />
        <AppText variant="small" numberOfLines={1} style={styles.grow}>
          {o.pickup.name}
        </AppText>
      </View>
      <View style={styles.route}>
        <IonIcon name="location-outline" size="sm" color={colors.inkMuted} />
        <AppText variant="small" numberOfLines={1} style={styles.grow}>
          {[o.drop?.name, o.drop?.area].filter(Boolean).join(' · ') || 'The customer'}
        </AppText>
      </View>
      <AppText variant="small" tone={o.cashToCollect ? 'accentDeep' : 'muted'}>
        {o.cashToCollect ? `Collect ${formatPKR(o.cashToCollect)} in cash` : 'Already paid: nothing to collect'}
      </AppText>
    </Card>
  );
};

const RiderDeliveriesScreen: React.FC = () => (
  <ServiceScope service="food">
    <RiderDeliveriesContent />
  </ServiceScope>
);

const RiderDeliveriesContent: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const r = useAppSelector(selectRiderHome);
  const [tracking, setTracking] = useState<RiderLocationState>(riderLocation.current);
  const [explain, setExplain] = useState(false);
  const [segment, setSegment] = useState<'active' | 'history'>('active');
  const onDuty = !!r.home?.rider.onDuty;

  const refetch = useCallback(() => {
    void dispatch(loadRiderDeliveriesAsync());
  }, [dispatch]);
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadRiderHomeAsync());
      refetch();
    }, [dispatch, refetch]),
  );
  useRiderChannel(refetch);
  const history = usePagedList((page, size) => getRiderOrdersAPI('history', page, size), riderOrdersPageSerializer, 'rider-history', { enabled: segment === 'history' });

  // Fixes go over the live connection, else the REST batch.
  useEffect(() => {
    riderLocation.setTransport(riderTransport);
    return riderLocation.subscribe(setTracking);
  }, []);
  // On duty holds tracking; off duty lets it go.
  useEffect(() => {
    if (!onDuty) return;
    void riderLocation.start();
    return () => void riderLocation.stop();
  }, [onDuty]);

  const goOnDuty = async () => {
    setExplain(false);
    if (Platform.OS !== 'web') await riderLocation.requestPermissions();
    void dispatch(setDutyAsync(true));
  };
  const toggleDuty = (next: boolean) => {
    if (!next) return void dispatch(setDutyAsync(false));
    if (Platform.OS === 'web') return void goOnDuty();
    void riderLocation.permissions().then(p => (p.foreground ? goOnDuty() : setExplain(true)));
  };

  const v = r.home?.vendor;
  const where = v ? placeLine(v.addressLine, v.area, v.city) : '';
  const open = (o: RiderOrder) => navigation.navigate('RiderOrder', { id: o.id });
  const rows = segment === 'active' ? r.active : history.rows;

  const header = (
    <View style={styles.head}>
      {r.error.message ? <InlineNotice message={r.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRiderHomeAsync()) }} /> : null}
      {Platform.OS === 'web' ? <InlineNotice tone="info" message="Deliveries work best in the MetroMatrix app on your phone, so your vendor and customers can see where you are." /> : null}
      <Card>
        <ToggleRow
          label={onDuty ? 'On duty' : 'Off duty'}
          helper={onDuty ? (TRACKING_LINE[tracking.mode] ?? 'Your vendor can give you deliveries.') : 'Go on duty to get deliveries. Nothing is shared while you’re off duty.'}
          value={onDuty}
          onChange={toggleDuty}
          disabled={r.dutyBusy || !r.home}
        />
        {onDuty && tracking.mode === 'denied' ? (
          <InlineNotice tone="warning" message="Location is off for MetroMatrix. Turn it on in your phone’s settings so your vendor and customers can follow deliveries." />
        ) : null}
        {r.dutyError.message ? <InlineNotice message={r.dutyError.message} /> : null}
      </Card>
      <View style={styles.chips}>
        <ChoiceChip label={`Now${r.active.length ? ` · ${r.active.length}` : ''}`} selected={segment === 'active'} onPress={() => setSegment('active')} />
        <ChoiceChip label="Past" selected={segment === 'history'} onPress={() => setSegment('history')} />
      </View>
    </View>
  );

  const footer = v ? (
    <Card padded="horizontal">
      <View style={styles.vendor}>
        <Avatar name={v.name} uri={v.logoUrl} size="md" />
        <View style={styles.grow}>
          <AppText variant="micro" tone="muted">
            YOU DELIVER FOR
          </AppText>
          <AppText variant="title">{v.name}</AppText>
          {where ? (
            <AppText variant="small" tone="muted">
              {where}
            </AppText>
          ) : null}
        </View>
      </View>
      {v.phone ? (
        <>
          <Divider />
          <ListRow title={`Call ${formatPkPhoneForDisplay(v.phone)}`} leftIcon="call-outline" onPress={() => callNumber(v.phone!)} />
        </>
      ) : null}
    </Card>
  ) : null;

  return (
    <ScreenShell title="Deliveries" subtitle={r.home ? `${r.home.rider.fullName} · ${riderVehicleLabel(r.home.rider.vehicle)}` : undefined} scroll={false} padded={false}>
      <FlatList
        data={rows}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onEndReached={segment === 'history' ? history.loadMore : undefined}
        refreshing={false}
        onRefresh={() => (segment === 'active' ? refetch() : history.refresh())}
        renderItem={({ item }) =>
          segment === 'active' ? (
            <DeliveryCard o={item} onPress={() => open(item)} />
          ) : (
            <Pressable onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${item.code}, ${item.statusLabel}`}>
              <Card>
                <View style={styles.row}>
                  <AppText variant="bodyStrong">{item.code}</AppText>
                  <AppText variant="small" tone="muted">
                    {item.statusLabel}
                  </AppText>
                </View>
                <AppText variant="small" tone="muted">
                  {`${item.pickup.name} → ${item.drop?.area ?? 'the customer'}${item.codCollected ? ` · collected ${formatPKR(item.codCollected)}` : ''}`}
                </AppText>
              </Card>
            </Pressable>
          )
        }
        ListEmptyComponent={
          (segment === 'active' ? r.activeStatus === 'loading' || !r.home : history.isLoading) ? (
            <SkeletonLines lines={4} />
          ) : segment === 'active' ? (
            <EmptyState
              icon="package"
              title={onDuty ? 'No deliveries right now' : 'You’re off duty'}
              body={onDuty ? `When ${v?.name ?? 'your vendor'} gives you an order, it appears here.` : 'Go on duty when you’re ready to deliver.'}
            />
          ) : (
            <EmptyState icon="clock" title="No past deliveries" body="Deliveries you finish show here." />
          )
        }
      />

      <Sheet visible={explain} onClose={() => setExplain(false)} title="Share your location on duty" subtitle={supportsBackgroundTracking() ? 'Also while the app is closed, only on duty.' : undefined}>
        <AppText variant="body" tone="muted">
          {`While you’re on duty or carrying an order, ${v?.name ?? 'your vendor'} sees where you are, and the customer sees you on their way. Go off duty and nothing is shared.`}
        </AppText>
        <Button label="Allow location" leftIcon="location-outline" onPress={() => void goOnDuty()} fullWidth />
        <Button label="Not now" variant="secondary" onPress={() => setExplain(false)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default RiderDeliveriesScreen;

