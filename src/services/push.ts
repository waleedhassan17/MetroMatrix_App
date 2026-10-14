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
