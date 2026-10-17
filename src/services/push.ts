// ═══════════════════════════════════════════════════════
// MetroMatrix — Expo push token
// ═══════════════════════════════════════════════════════
// Not available: on web; on an emulator/simulator; in Expo Go on Android
// (remote push was removed from Expo Go in SDK 53); without an EAS
// projectId (getExpoPushTokenAsync requires one). In each case this returns
// null and the app simply runs without push.
//
// expo-notifications is required lazily, after those checks, so Expo Go
// never initialises the push half of the module.

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
  Constants.easConfig?.projectId;

export const isPushSupported = (): boolean =>
  Platform.OS !== 'web' &&
  Device.isDevice &&
  !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) &&
  !!projectId();

/**
 * `ask: false` only reads an existing grant (silent re-registration on each
 * session); `ask: true` shows the OS permission dialog.
 */
export const obtainPushToken = async (ask: boolean): Promise<string | null> => {
  if (!isPushSupported()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  return token.data;
};

export const pushPlatform = (): 'android' | 'ios' | 'web' =>
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/**
 * Where a tapped push goes, as one of the app's own deep links (the
 * navigation container routes it). The API puts groupCode / orderId /
 * returnId / productId in the push's data, as it does for in-app
 * notifications. TODO(API_SHOPPING): confirm the push data keys.
 */
export const pushTapUrl = (data: Record<string, unknown> | null | undefined, isStore: boolean): string | null => {
  const s = (k: string) => (typeof data?.[k] === 'string' && data[k] ? (data[k] as string) : null);
  if (isStore) {
    // A doctor's appointment pushes carry appointmentCode (API_HEALTH §6); doctor routes take the code.
    const visit = s('appointmentCode') ?? s('appointmentId');
    if (visit) return `metromatrix://doctor/appointments/${encodeURIComponent(visit)}`;
    if (s('returnId')) return `metromatrix://store/returns/${encodeURIComponent(s('returnId')!)}`;
    if (s('orderId')) return `metromatrix://store/orders/${encodeURIComponent(s('orderId')!)}`;
    return null;
  }
  if (s('prescriptionId')) return `metromatrix://profile/prescriptions/${encodeURIComponent(s('prescriptionId')!)}`;
  if (s('appointmentCode')) return `metromatrix://health/appointment/${encodeURIComponent(s('appointmentCode')!)}`;
  if (s('groupCode')) return `metromatrix://orders/${encodeURIComponent(s('groupCode')!)}`;
  if (s('productId')) return `metromatrix://shop/product/${encodeURIComponent(s('productId')!)}`;
  return null;
};

/** Calls `handler` with a tapped push's data; returns the unsubscribe. A no-op where push isn't available. */
export const onPushTap = (handler: (data: Record<string, unknown>) => void): (() => void) => {
  if (!isPushSupported()) return () => undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  const sub = Notifications.addNotificationResponseReceivedListener(r => handler((r.notification.request.content.data ?? {}) as Record<string, unknown>));
  return () => sub.remove();
};
