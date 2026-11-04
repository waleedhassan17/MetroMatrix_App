// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Profile
// ═══════════════════════════════════════════════════════
// Stateless: reads the rider's details (riderHome) and the session. Riders
// change their own password; a forgotten one is reset by their vendor.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useSignOut } from '../../hooks/useSignOut';
import { riderVehicleLabel } from '../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Avatar, Card, Divider, InlineNotice, ListRow, RowCardsSkeleton, ScreenShell, Skeleton } from '../../Custom-Components/index';
import { ToolSection } from '../../Components/admin/AdminParts';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { selectUser } from '../../store/authSlice';
import { loadRiderHomeAsync, selectRiderHome } from '../rider-deliveries-screen/riderHomeSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    grow: { flex: 1, gap: space.s4 },
  });

const RiderProfile: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const { home, active, status, error } = useAppSelector(selectRiderHome);
  const { confirmSignOut } = useSignOut();

  useEffect(() => {
    if (!home) void dispatch(loadRiderHomeAsync());
  }, [dispatch, home]);

  const name = home?.rider.fullName ?? user?.name ?? 'Rider';
  return (
    <ServiceScope service="food">
      <ScreenShell title="Profile" subtitle={home ? `Rider for ${home.vendor.name}` : undefined} refreshing={status === 'loading' && !!home} onRefresh={() => void dispatch(loadRiderHomeAsync())}>
        {error.message && !home ? <InlineNotice message={error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRiderHomeAsync()) }} /> : null}
        <Card>
          <View style={styles.identity}>
            <Avatar name={name} size="lg" />
            <View style={styles.grow}>
              <AppText variant="title" numberOfLines={1}>
                {name}
              </AppText>
              {home ? (
                <AppText variant="small" tone="muted">
                  {`Rider for ${home.vendor.name} · ${riderVehicleLabel(home.rider.vehicle)}`}
                </AppText>
              ) : status === 'loading' ? (
                <Skeleton width="60%" />
              ) : null}
            </View>
          </View>
        </Card>
        {home ? (
          // Details only the vendor changes: rows without a chevron.
          <Card padded="horizontal">
            <ListRow title={home.rider.username ?? 'No username'} subtitle="Username — you sign in with it" leftIcon="person-outline" tint="grey" chevron={false} />
            <Divider />
            <ListRow title={riderVehicleLabel(home.rider.vehicle)} subtitle="Vehicle" leftIcon="bicycle-outline" tint="teal" chevron={false} />
            {home.rider.phone ? (
              <>
                <Divider />
                <ListRow title={formatPkPhoneForDisplay(home.rider.phone)} subtitle="Phone" leftIcon="call-outline" tint="green" chevron={false} />
              </>
            ) : null}
          </Card>
        ) : status === 'loading' ? (
          <RowCardsSkeleton count={2} />
        ) : null}
        <AppText variant="small" tone="muted">
          Your vendor keeps these details. Ask them to change your phone or vehicle.
        </AppText>
        <ToolSection
          title="Account"
          tools={[
            { key: 'password', title: 'Change password', icon: 'key-outline', tint: 'amber', onPress: () => navigation.navigate('ChangePassword') },
            { key: 'notifications', title: 'Notifications', icon: 'notifications-outline', tint: 'violet', onPress: () => navigation.navigate('Notifications') },
          ]}
        />
        <Card padded="horizontal">
          <ListRow
            title="Sign out"
            subtitle={active.length ? `Finish or hand back your ${active.length === 1 ? 'delivery' : `${active.length} deliveries`} first.` : undefined}
            leftIcon="log-out-outline"
            tint="red"
            onPress={active.length ? () => navigation.navigate('RiderTabs', { screen: 'DeliveriesTab' }) : confirmSignOut}
            chevron={false}
          />
        </Card>
      </ScreenShell>
    </ServiceScope>
  );
};

export default RiderProfile;
