// LiveDot — a status dot with a soft ring that pulses outward, the "live
// now" signal. Still (no ring) under reduced motion. Opacity and transform
// only, on the native driver.

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

export const LiveDot: React.FC<{ color: string; size?: number }> = ({ color, size }) => {
  const { space, radius, motion } = useTheme();
  const dim = size ?? space.s8;
  const [pulse] = useState(() => new Animated.Value(0));
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduced => {
        if (cancelled || reduced) return;
        setAnimate(true);
        loop = Animated.loop(
          Animated.timing(pulse, {
            toValue: 1,
            duration: motion.livePulse.duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse, motion.livePulse.duration]);

  const dot = { width: dim, height: dim, borderRadius: radius.pill, backgroundColor: color };
  return (
    <View style={{ width: dim, height: dim }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {animate ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            dot,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, motion.livePulse.scale] }) }],
            },
          ]}
        />
      ) : null}
      <View style={dot} />
    </View>
  );
};

export default LiveDot;
