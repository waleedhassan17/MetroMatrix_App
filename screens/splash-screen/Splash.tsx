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
// Just the mark, the wordmark and the line under it: no services row (the
// owner found it odd on the splash).
//
// One Animated sequence, no timers: it stops on unmount, and `onDone` hangs
// off its completion (pass a stable callback, or the sequence restarts).
// Opacity and transforms only, all on the native driver.
// Reduced motion jumps to the end state and holds briefly.

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { BrandMark, BrandWordmark } from '../../Components/brand';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';

const makeStyles = ({ colors, space, size }: Theme) =>
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
  });

export const Splash: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const styles = useStyles(makeStyles);
  const { size, motion } = useTheme();

  const [wordOpacity] = useState(() => new Animated.Value(0));
  const [wordY] = useState(() => new Animated.Value(12));
  const [tagOpacity] = useState(() => new Animated.Value(0));
  const [tagY] = useState(() => new Animated.Value(8));

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
          [wordOpacity, tagOpacity].forEach(v => v.setValue(1));
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
  }, [motion.splash, onDone, tagOpacity, tagY, wordOpacity, wordY]);

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
    </View>
  );
};

export default Splash;
