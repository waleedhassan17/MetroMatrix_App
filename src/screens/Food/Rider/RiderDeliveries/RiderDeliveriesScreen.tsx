// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Deliveries
// ═══════════════════════════════════════════════════════
// The vendor the rider delivers for (call them, find the kitchen) and the
// deliveries they're offered. The duty switch, offers and the live trip
// arrive with the API's rider phase.
// TODO(API_FOOD): duty, offers and the active delivery.

import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { riderVehicleLabel } from '@models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Avatar, Card, Divider, EmptyState, InlineNotice, ListRow, ScreenShell, SkeletonLines } from '@custom/index';
import { callNumber } from '@utils/maps';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { loadRiderHomeAsync, selectRiderHome } from './riderHomeSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    vendor: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

const RiderDeliveriesScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { home, status, error } = useAppSelector(selectRiderHome);

  useEffect(() => {
    void dispatch(loadRiderHomeAsync());
  }, [dispatch]);

  const v = home?.vendor;
  // The area and city only when the address line doesn't already say them.
  const where = v
    ? [v.addressLine, v.area, v.city].filter((p, i, all): p is string => !!p && !all.slice(0, i).some(q => q?.toLowerCase().includes(p.toLowerCase()))).join(', ')
    : '';
  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Deliveries"
        subtitle={home ? `${home.rider.fullName} · ${riderVehicleLabel(home.rider.vehicle)}` : undefined}
        refreshing={status === 'loading' && !!home}
        onRefresh={() => void dispatch(loadRiderHomeAsync())}
      >
        {error.message ? <InlineNotice message={error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRiderHomeAsync()) }} /> : null}
        {Platform.OS === 'web' ? (
          <InlineNotice tone="info" message="Deliveries need the MetroMatrix app on your phone, so your vendor and customers can see where you are." />
        ) : null}
        {!home ? (
          status === 'failed' ? null : <SkeletonLines lines={5} />
        ) : (
          <>
            <Card padded="horizontal">
              <View style={styles.vendor}>
                <Avatar name={v!.name} uri={v!.logoUrl} size="md" />
                <View style={styles.grow}>
                  <AppText variant="micro" tone="muted">
                    YOU DELIVER FOR
                  </AppText>
                  <AppText variant="title">{v!.name}</AppText>
                  {where ? (
                    <AppText variant="small" tone="muted">
                      {where}
                    </AppText>
                  ) : null}
                </View>
              </View>
              {v!.phone ? (
                <>
                  <Divider />
                  <ListRow title={`Call ${formatPkPhoneForDisplay(v!.phone)}`} leftIcon="call-outline" onPress={() => callNumber(v!.phone!)} />
                </>
              ) : null}
            </Card>
            <EmptyState icon="package" title="No deliveries yet" body={`When ${v!.name} sends you an order, it appears here to accept.`} />
          </>
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default RiderDeliveriesScreen;
