// ═══════════════════════════════════════════════════════
// LargeTitleHeader — a large title that collapses into the bar on scroll
// ═══════════════════════════════════════════════════════
// Two pieces sharing one `scrollY`:
//   LargeTitleHeader  the fixed bar: back, right action, and a small title
//                     that fades in as the large one scrolls away
//   LargeTitleBlock   the large title + subtitle, first thing in the content
// ScreenShell wires both; screens never place them by hand.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface LargeTitleHeaderProps {
  title?: string;
  scrollY: SharedValue<number>;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}

const makeStyles = ({ size, space, colors, gutter }: Theme) =>
  StyleSheet.create({
    bar: {
      height: size.headerBar,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.s8,
      backgroundColor: colors.canvas,
    },
    side: { minWidth: size.touch, flexDirection: 'row', alignItems: 'center' },
    sideRight: { justifyContent: 'flex-end' },
    center: { flex: 1, alignItems: 'center', paddingHorizontal: space.s8 },
    hairline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: size.hairline,
      backgroundColor: colors.line,
    },
    block: { paddingHorizontal: gutter, paddingTop: space.s8, paddingBottom: space.s24, gap: space.s8 },
  });

export const LargeTitleHeader: React.FC<LargeTitleHeaderProps> = ({
  title,
  scrollY,
  onBack,
  backLabel = 'Back',
  right,
}) => {
  const styles = useStyles(makeStyles);
  const { motion } = useTheme();
  const collapse = motion.titleCollapse;

  const smallTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [collapse * 0.6, collapse], [0, 1], Extrapolation.CLAMP),
  }));
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, collapse], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? <IconButton icon="arrow-left" onPress={onBack} accessibilityLabel={backLabel} /> : null}
      </View>
      <Animated.View style={[styles.center, smallTitle]} importantForAccessibility="no-hide-descendants">
        {title ? (
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
      </Animated.View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
      <Animated.View style={[styles.hairline, hairline]} />
    </View>
  );
};

export const LargeTitleBlock: React.FC<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  scrollY: SharedValue<number>;
}> = ({ title, subtitle, eyebrow, scrollY }) => {
  const styles = useStyles(makeStyles);
  const { motion } = useTheme();
  const collapse = motion.titleCollapse;
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, collapse], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.block, fade]}>
      {eyebrow ? (
        <AppText variant="micro" tone="accentDeep">
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="h1" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" tone="muted">
          {subtitle}
        </AppText>
      ) : null}
    </Animated.View>
  );
};

export default LargeTitleHeader;
