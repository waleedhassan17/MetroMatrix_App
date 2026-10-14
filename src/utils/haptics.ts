// ═══════════════════════════════════════════════════════
// MetroMatrix — Haptics
// ═══════════════════════════════════════════════════════
// Three meanings, nothing more: a light tap on a primary press, success when
// a submit lands, a warning when it fails. Never throws, no-op on web.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

const safe = (fn: () => Promise<void>) => {
  if (!enabled) return;
  fn().catch(() => {
    /* haptics unavailable (emulator, power saving) — never block the UI */
  });
};

export const haptics = {
  press: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
