// ═══════════════════════════════════════════════════════
// MetroMatrix — Realtime check (dev only, /dev/realtime)
// ═══════════════════════════════════════════════════════
// Proves the Food foundation on a device or in the browser, signed in:
//   • the live connection: status, a test room, drop → reconnect → resync;
//   • the rider's location: mode (background / foreground / denied), each
//     fix, the 15 s heartbeat, what's queued while the line is down;
//   • the vendor's new-order alert: ring until stopped (web: one tap first);
//   • the layout class (phone / tablet at 768 dp).
// Local state only: nothing here is app data. Registered only when __DEV__.

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, Button, Card, Divider, ScreenShell, StatusPill } from '@custom/index';
import { useStyles, type Theme } from '@theme/index';
import type { CustomerStackParamList } from '@/types';
import { useBack } from '@hooks/useBack';
import { useLayoutClass } from '@hooks/useLayoutClass';
import { useRealtimeResync, useRealtimeRoom, useRealtimeStatus } from '@hooks/useRealtime';
import { useAppSelector } from '@hooks/useReduxHooks';
import { selectRealtimeReconnects } from '@store/realtimeSlice';
import { USE_MOCK_API } from '../../../config/env';
import { realtime } from '../../../services/realtime/socketClient';
import { REALTIME_SEND } from '../../../services/realtime/realtimeConfig';
import { riderLocation, supportsBackgroundTracking, type RiderLocationState } from '../../../services/location/riderLocation';
import { orderAlert, type OrderAlertState } from '../../../services/orderAlert';
import { FoodMap, type MapPin, type MapPoint } from '@custom/food/map/FoodMap';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RealtimeCheck'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    stack: { gap: space.s16, paddingBottom: space.s32 },
    card: { gap: space.s12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s12 },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <AppText variant="body" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
};

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString() : '—');

// A demo ride in Lahore: Gulberg (kitchen) to Model Town (drop-off).
const KITCHEN: MapPoint = { lat: 31.5102, lng: 74.3441 };
const DROP: MapPoint = { lat: 31.4848, lng: 74.3238 };
const DEMO_PINS: MapPin[] = [
  { id: 'kitchen', kind: 'vendor', at: KITCHEN, label: 'Demo kitchen, Gulberg' },
  { id: 'drop', kind: 'drop', at: DROP, label: 'Demo drop-off, Model Town' },
];
const RIDE_STEPS = 12;
/** Every 2 s the demo rider moves a step along the straight line. */
const RIDE_STEP_MS = 2000;

export const RealtimeCheckScreen: React.FC<Props> = () => {
  const styles = useStyles(makeStyles);
  const { back } = useBack({ name: 'CustomerHome' });
  const layout = useLayoutClass();
  const status = useRealtimeStatus();
  const reconnects = useAppSelector(selectRealtimeReconnects);
  const [resyncs, setResyncs] = useState(0);
  const [roomOn, setRoomOn] = useState(false);
  const room = useRealtimeRoom(roomOn ? 'dev-check' : null, roomOn ? { orderId: 'dev-check' } : null);
  useRealtimeResync(() => setResyncs(n => n + 1));

  const [loc, setLoc] = useState<RiderLocationState>(riderLocation.current);
  const [sent, setSent] = useState(0);
  const [tracking, setTracking] = useState(false);
  useEffect(() => riderLocation.subscribe(setLoc), []);
  useEffect(() => {
    if (!USE_MOCK_API) return;
    // Dummy API without the Food routes yet: answer the check's own events.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockRealtime } = require('../../../networks/network/mock/mockRealtime') as typeof import('../../../networks/network/mock/mockRealtime');
    if (!mockRealtime.hasHandler('subscribe')) {
      mockRealtime.handle('subscribe', (ctx, payload: { orderId?: string }) => {
        if (payload?.orderId !== 'dev-check') return { ok: false, code: 'NOT_FOUND' };
        ctx.join('order:dev-check');
        return { ok: true };
      });
    }
    if (!mockRealtime.hasHandler(REALTIME_SEND.riderLocation)) {
      mockRealtime.handle(REALTIME_SEND.riderLocation, (_ctx, payload: { fixes?: unknown[] }) => ({
        ok: true,
        accepted: payload?.fixes?.length ?? 0,
      }));
    }
  }, []);
  useEffect(() => {
    // The check's own transport: the live connection first, then a pretend REST batch.
    riderLocation.setTransport({
      sendLive: async fixes => {
        const ack = (await realtime.send(REALTIME_SEND.riderLocation, { fixes })) as { ok?: boolean } | false;
        const ok = !!ack && ack.ok !== false;
        if (ok) setSent(n => n + fixes.length);
        return ok;
      },
      sendBatch: async fixes => {
        setSent(n => n + fixes.length);
      },
    });
    return () => {
      riderLocation.setTransport(null);
    };
  }, []);
  useEffect(
    () => () => {
      if (tracking) void riderLocation.stop();
    },
    [tracking],
  );

  const [ride, setRide] = useState<number | null>(null);
  useEffect(() => {
    if (ride === null || ride >= RIDE_STEPS) return;
    const t = setTimeout(() => setRide(r => (r === null ? null : r + 1)), RIDE_STEP_MS);
    return () => clearTimeout(t);
  }, [ride]);
  const riderAt: MapPoint | null =
    ride === null
      ? loc.lastFix
      : {
          lat: KITCHEN.lat + ((DROP.lat - KITCHEN.lat) * ride) / RIDE_STEPS,
          lng: KITCHEN.lng + ((DROP.lng - KITCHEN.lng) * ride) / RIDE_STEPS,
        };

  const [alert, setAlert] = useState<OrderAlertState>(orderAlert.state);
  useEffect(() => orderAlert.subscribe(setAlert), []);
  useEffect(() => () => orderAlert.stop(), []);

  return (
    <ScreenShell title="Realtime check" subtitle="Food foundation, dev only" onBack={back}>
      <View style={styles.stack}>
        <Card style={styles.card}>
          <AppText variant="sectionTitle">Live connection</AppText>
          <View style={styles.row}>
            <AppText variant="body" tone="muted">
              Status
            </AppText>
            <StatusPill label={status} tone={status === 'connected' ? 'success' : status === 'idle' ? 'neutral' : 'warning'} />
          </View>
          <Row label="Reconnects" value={String(reconnects)} />
          <Row label="Resyncs (REST refetch)" value={String(resyncs)} />
          <Row label="Test room" value={!roomOn ? 'not joined' : room.joined ? 'joined' : (room.code ?? 'joining')} />
          <View style={styles.buttons}>
            <Button label={roomOn ? 'Leave the test room' : 'Join a test room'} variant="secondary" size="sm" onPress={() => setRoomOn(v => !v)} />
            {USE_MOCK_API ? (
              <Button
                label="Drop the connection"
                variant="secondary"
                size="sm"
                onPress={() => {
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  const { mockRealtime } = require('../../../networks/network/mock/mockRealtime');
                  mockRealtime.dropAll();
                }}
              />
            ) : null}
          </View>
        </Card>

        <Card style={styles.card}>
          <AppText variant="sectionTitle">Rider location</AppText>
          <Row label="Mode" value={loc.mode} />
          <Row label="Background possible here" value={supportsBackgroundTracking() ? 'yes (a build)' : 'no (Expo Go or web)'} />
          <Row label="Last fix" value={loc.lastFix ? `${loc.lastFix.lat.toFixed(5)}, ${loc.lastFix.lng.toFixed(5)}` : '—'} />
          <Row label="Last sent" value={clock(loc.lastSentAt)} />
          <Row label="Fixes sent" value={String(sent)} />
          <Row label="Waiting to send" value={String(loc.queued)} />
          <Divider />
          <View style={styles.buttons}>
            {tracking ? (
              <Button
                label="Go off duty"
                variant="secondary"
                size="sm"
                onPress={() => {
                  setTracking(false);
                  void riderLocation.stop();
                }}
              />
            ) : (
              <Button
                label="Go on duty"
                size="sm"
                onPress={async () => {
                  await riderLocation.requestPermissions();
                  setTracking(true);
                  await riderLocation.start();
                }}
              />
            )}
          </View>
        </Card>

        <Card style={styles.card}>
          <AppText variant="sectionTitle">New-order alert</AppText>
          <Row label="Ringing" value={alert.ringing ? 'yes' : 'no'} />
          {alert.blocked ? (
            <Button label="Tap to turn on order sound" size="sm" onPress={() => orderAlert.unlock()} />
          ) : null}
          <View style={styles.buttons}>
            <Button label="Ring" size="sm" onPress={() => orderAlert.start()} />
            <Button label="Stop" variant="secondary" size="sm" onPress={() => orderAlert.stop()} />
          </View>
        </Card>

        <Card style={styles.card}>
          <AppText variant="sectionTitle">Map</AppText>
          <FoodMap pins={DEMO_PINS} rider={riderAt} height={220} accessibilityLabel="Demo map: a kitchen in Gulberg, a drop-off in Model Town" />
          <Row label="Rider" value={ride === null ? (loc.lastFix ? 'your location' : 'none') : `step ${ride} of ${RIDE_STEPS}`} />
          <View style={styles.buttons}>
            <Button label="Simulate a ride" size="sm" onPress={() => setRide(0)} />
            {ride !== null ? <Button label="Stop the ride" variant="secondary" size="sm" onPress={() => setRide(null)} /> : null}
          </View>
        </Card>

        <Card style={styles.card}>
          <AppText variant="sectionTitle">Layout</AppText>
          <Row label="Layout class" value={layout} />
        </Card>
      </View>
    </ScreenShell>
  );
};

export default RealtimeCheckScreen;
