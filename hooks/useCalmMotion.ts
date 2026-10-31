// ═══════════════════════════════════════════════════════
// useCalmMotion — nothing moves by itself for people who asked it not to
// ═══════════════════════════════════════════════════════
// True while reduce motion is on, or while a screen reader runs on a phone.
// The web can't tell whether a screen reader is running (react-native-web
// always answers yes), so there only reduce motion counts. Rotating search
// hints and auto-advancing banners hold still while it's true.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export const useCalmMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(v => live && setReduced(v));
    const subs = [AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)];
    if (Platform.OS !== 'web') {
      void AccessibilityInfo.isScreenReaderEnabled()
        .catch(() => false)
        .then(v => live && setReader(v));
      subs.push(AccessibilityInfo.addEventListener('screenReaderChanged', setReader));
    }
    return () => {
      live = false;
      // react-native-web returns nothing when the page can't match media.
      subs.forEach(s => s?.remove());
    };
  }, []);
  return reduced || reader;
};
