// CountBadge — a small count on an icon. Hidden at zero; "99+" past 99.
// `alert` is the header Bag's and bell's: red, ringed in the ground it sits
// on (the header's own colour, or white), so it matches the tab bar's badge.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';
import { useOnGradient } from '../headerInk';
import { CIRCLE_SLOP, useCircleAction } from '../IconButton';

const makeStyles = ({ size, radius, space, colors }: Theme) =>
  StyleSheet.create({
    button: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
    circle: {
      width: size.headerWell,
      height: size.headerWell,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    badge: {
      position: 'absolute',
      top: space.s4,
      right: space.s0,
      minWidth: size.countBadge,
      height: size.countBadge,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
    },
    badgeOnCircle: { top: -size.focusBorder, right: -size.focusBorder },
  });

export const CountBadge: React.FC<{ count: number; tone?: 'accent' | 'alert' }> = ({ count, tone = 'accent' }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, header } = useTheme();
  const onGradient = useOnGradient();
  if (count <= 0) return null;
  const look =
    tone === 'alert'
      ? { bg: colors.danger, fg: colors.onDanger, ring: onGradient ? header.gradient[0] : colors.surface }
      : onGradient
        ? // On the gradient header the badge turns white, ringed in the header's own deep accent.
          { bg: colors.surface, fg: service.accentDeep, ring: service.accentDeep }
        : { bg: service.accent, fg: service.onAccent, ring: colors.surface };
  return (
    <View
      style={[styles.badge, tone === 'alert' && styles.badgeOnCircle, { backgroundColor: look.bg, borderColor: look.ring }]}
      pointerEvents="none">
      <AppText variant="micro" style={{ color: look.fg }}>
        {count > 99 ? '99+' : count}
      </AppText>
    </View>
  );
};

/** A header icon with a count — "Bag, 3 items". */
export const CountIconButton: React.FC<{
  icon: IonName;
  count: number;
  onPress: () => void;
  label: string;
  tone?: 'ink' | 'onScrim';
  /** `circle`: the white circle off the header too (over a photo, lifted). */
  appearance?: 'plain' | 'circle';
}> = ({ icon, count, onPress, label, tone: toneProp, appearance }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity, elevation } = useTheme();
  const onGradient = useOnGradient();
  const circle = useCircleAction(toneProp ? 'plain' : appearance);
  const a11yLabel = count > 0 ? `${label}, ${count} ${count === 1 ? 'item' : 'items'}` : label;
  if (circle) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={CIRCLE_SLOP}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [styles.circle, !onGradient && elevation.raised, pressed && { opacity: opacity.pressed }]}>
        <IonIcon name={icon} size="md" color={colors.ink} />
        <CountBadge count={count} tone="alert" />
      </Pressable>
    );
  }
  const tone = toneProp ?? (onGradient ? 'onScrim' : 'ink');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.pressed }]}>
      <IonIcon name={icon} size="lg" color={tone === 'onScrim' ? colors.onScrim : colors.ink} />
      <CountBadge count={count} />
    </Pressable>
  );
};

export default CountBadge;
