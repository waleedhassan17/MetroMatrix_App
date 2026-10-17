// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Profile
// ═══════════════════════════════════════════════════════
// Stateless: reads the rider's details (riderHome) and the session. Riders
// change their own password; a forgotten one is reset by their vendor.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { riderVehicleLabel } from '@models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Avatar, Card, Divider, ListRow, ScreenShell } from '@custom/index';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { selectUser } from '../../../Auth/authSlice';
import { loadRiderHomeAsync, selectRiderHome } from '../RiderDeliveries/riderHomeSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    hero: { alignItems: 'center', gap: space.s8, paddingVertical: space.s16 },
  });

const RiderProfileScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const { home } = useAppSelector(selectRiderHome);
  const { confirmSignOut } = useSignOut();

  useEffect(() => {
    if (!home) void dispatch(loadRiderHomeAsync());
  }, [dispatch, home]);

  const name = home?.rider.fullName ?? user?.name ?? 'Rider';
  return (
    <ServiceScope service="food">
      <ScreenShell title="Profile">
        <View style={styles.hero}>
          <Avatar name={name} size="lg" />
          <AppText variant="h2">{name}</AppText>
          {home ? (
            <AppText variant="small" tone="muted">
              {`Rider for ${home.vendor.name}`}
            </AppText>
          ) : null}
        </View>
        <Card padded="horizontal">
          <ListRow title={home?.rider.username ?? '—'} subtitle="Username" leftIcon="person-outline" chevron={false} />
          <Divider />
          <ListRow title={riderVehicleLabel(home?.rider.vehicle ?? null)} subtitle="Vehicle" leftIcon="bicycle-outline" chevron={false} />
          {home?.rider.phone ? (
            <>
              <Divider />
              <ListRow title={formatPkPhoneForDisplay(home.rider.phone)} subtitle="Phone" leftIcon="call-outline" chevron={false} />
            </>
          ) : null}
        </Card>
        <AppText variant="small" tone="muted">
          Your vendor keeps these details. Ask them to change your phone or vehicle.
        </AppText>
        <Card padded="horizontal">
          <ListRow title="Change password" leftIcon="key-outline" onPress={() => navigation.navigate('ChangePassword')} />
          <Divider />
          <ListRow title="Notifications" leftIcon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
        </Card>
        <Card padded="horizontal">
          <ListRow title="Sign out" leftIcon="log-out-outline" onPress={confirmSignOut} chevron={false} />
        </Card>
      </ScreenShell>
    </ServiceScope>
  );
};

export default RiderProfileScreen;
