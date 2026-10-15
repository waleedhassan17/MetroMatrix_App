// ═══════════════════════════════════════════════════════
// MetroMatrix — Splash (ported from the FYP app)
// ═══════════════════════════════════════════════════════
// A short brand moment on every launch, played as an overlay above the
// navigator so it can never land on a stale route.
//
// THE MARK NEVER MOVES. The native splash (app.json → splash-mark.png at
// size.splashMark) paints the logo at the window's exact centre; this screen
// paints the same file at the same size in the same place from its first
// frame, so native → JS reads as one continuous moment. No safe-area inset:
// it would shift the centre off the window's and the tile would jump.
//
// One Animated sequence, no timers: it stops on unmount, and `onDone` hangs
// off its completion (pass a stable callback, or the sequence restarts).
// Opacity and transforms only, all on the native driver.
// Reduced motion jumps to the end state and holds briefly.

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, BrandWordmark } from '../../../components/brand';
import { SERVICE_PALETTES, useStyles, useTheme, type ServiceName, type Theme } from '../../../theme';
import { AppText } from '../../../Custom-Components/AppText';

/** The three services, in the order onboarding introduces them. */
const SERVICES: { service: Exclude<ServiceName, 'neutral'>; label: string }[] = [
  { service: 'food', label: 'Food Court' },
  { service: 'healthcare', label: 'Healthcare' },
  { service: 'shopping', label: 'Shopping' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas },
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    // Hung from the window's centre, so the mark above it stays put.
    below: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      marginTop: size.splashMark / 2 + space.s24,
      alignItems: 'center',
      gap: space.s4,
    },
    footer: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: space.s16 },
    service: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    dot: { width: space.s8, height: space.s8, borderRadius: radius.pill },
  });

export const SplashScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const styles = useStyles(makeStyles);
  const { size, space, motion } = useTheme();
  const insets = useSafeAreaInsets();

  const [wordOpacity] = useState(() => new Animated.Value(0));
  const [wordY] = useState(() => new Animated.Value(12));
  const [tagOpacity] = useState(() => new Animated.Value(0));
  const [tagY] = useState(() => new Animated.Value(8));
  const [footOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let sequence: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    const ease = Easing.out(Easing.cubic);
    const fade = (v: Animated.Value, duration: number, toValue = 1) =>
      Animated.timing(v, { toValue, duration, easing: ease, useNativeDriver: true });
    const t = motion.splash;

    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduced => {
        if (cancelled) return;
        if (reduced) {
          [wordOpacity, tagOpacity, footOpacity].forEach(v => v.setValue(1));
          wordY.setValue(0);
          tagY.setValue(0);
          sequence = Animated.delay(600);
        } else {
          // The mark holds still while the words arrive under it.
          sequence = Animated.sequence([
            Animated.delay(t.lead),
            Animated.stagger(t.stagger, [
              Animated.parallel([fade(wordOpacity, t.word), fade(wordY, t.word, 0)]),
              Animated.parallel([fade(tagOpacity, t.tag), fade(tagY, t.tag, 0)]),
              fade(footOpacity, t.tag),
            ]),
            Animated.delay(t.hold),
          ]);
        }
        sequence.start(({ finished }) => finished && onDone());
      });

    return () => {
      cancelled = true;
      sequence?.stop();
    };
  }, [footOpacity, motion.splash, onDone, tagOpacity, tagY, wordOpacity, wordY]);

  return (
    <View style={styles.root} accessibilityLabel="MetroMatrix is starting" accessibilityRole="image">

      <View style={styles.centre} pointerEvents="none">
        <BrandMark size={size.splashMark} />
      </View>

      <View style={styles.below} pointerEvents="none">
        <Animated.View style={{ opacity: wordOpacity, transform: [{ translateY: wordY }] }}>
          <BrandWordmark variant="display" />
        </Animated.View>
        <Animated.View style={{ opacity: tagOpacity, transform: [{ translateY: tagY }] }}>
          <AppText variant="body" tone="muted">
            Smart City Services
          </AppText>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.footer, { bottom: insets.bottom + space.s24, opacity: footOpacity }]}
        pointerEvents="none"
        accessibilityLabel="Food, healthcare and shopping">
        {SERVICES.map(s => (
          <View key={s.service} style={styles.service}>
            <View style={[styles.dot, { backgroundColor: SERVICE_PALETTES.light[s.service].highlight }]} />
            <AppText variant="caption" tone="muted">
              {s.label}
            </AppText>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

export default SplashScreen;
