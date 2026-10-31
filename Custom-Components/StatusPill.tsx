// StatusPill — a micro label on a soft tint. Springs in when it appears.

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const makeStyles = ({ space, radius }: Theme) =>
  StyleSheet.create({
    root: {
      alignSelf: 'flex-start',
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
    },
  });

export const StatusPill: React.FC<{ label: string; tone?: PillTone }> = ({ label, tone = 'neutral' }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, motion } = useTheme();
  const scale = useSharedValue(0.8);
  useEffect(() => {
    scale.set(withSpring(1, motion.spring));
  }, [scale, motion.spring]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const look = {
    neutral: { bg: colors.surfaceSunk, fg: colors.inkMuted },
    accent: { bg: service.accentSoft, fg: service.accentDeep },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: look.bg }, animated]}
      accessible
      accessibilityLabel={`Status: ${label}`}>
      <AppText variant="micro" style={{ color: look.fg }}>
        {label}
      </AppText>
    </Animated.View>
  );
};

export default StatusPill;
