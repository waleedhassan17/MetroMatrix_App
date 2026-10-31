// Skeleton — the loading state for content. A sunk shape whose opacity
// breathes; never a gradient sweep, never a centred spinner.

import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '../theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  shape?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({ block: { backgroundColor: colors.surfaceSunk } });

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height, shape = 'sm' }) => {
  const styles = useStyles(makeStyles);
  const { radius, motion, opacity, type } = useTheme();
  const pulse = useSharedValue<number>(opacity.skeletonHigh);

  useEffect(() => {
    pulse.set(withRepeat(
      withTiming(opacity.skeletonLow, { duration: motion.pulse.duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    ));
  }, [pulse, opacity.skeletonLow, motion.pulse.duration]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height: height ?? (type.body.lineHeight as number), borderRadius: radius[shape] },
        animated,
      ]}
    />
  );
};

/** A stack of text-line skeletons; the last line is shorter, like a paragraph. */
export const SkeletonLines: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.s8 }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
};

export default Skeleton;
