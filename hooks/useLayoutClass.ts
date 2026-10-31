// ═══════════════════════════════════════════════════════
// useLayoutClass — phone or tablet, by the window's width
// ═══════════════════════════════════════════════════════
// The vendor's order board and menu manager change shape from `tablet` up
// (breakpoints.tablet, 768 dp): four board columns, a master–detail menu.
// It follows the window, not the device, so a laptop browser and a tablet
// turned sideways both get the wide layout.
//
// useOrientationPolicy (mounted once in AppContainer): phones stay in
// portrait, tablets may turn. app.json allows every orientation so a tablet
// can rotate; this locks phones back to portrait at runtime. Web: no-op.

import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as Device from 'expo-device';
import { breakpoints } from '../theme/tokens';

export type LayoutClass = 'phone' | 'tablet';

export const layoutClassFor = (width: number): LayoutClass => (width >= breakpoints.tablet ? 'tablet' : 'phone');

export const useLayoutClass = (): LayoutClass => {
  const { width } = useWindowDimensions();
  return layoutClassFor(width);
};

export const useOrientationPolicy = () => {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ScreenOrientation = require('expo-screen-orientation') as typeof import('expo-screen-orientation');
    const tablet = Device.deviceType === Device.DeviceType.TABLET;
    const apply = tablet
      ? ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    apply.catch(() => {
      /* orientation can't be set here (an emulator, split screen) — the OS default stands */
    });
  }, []);
};
