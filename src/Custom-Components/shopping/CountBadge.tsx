// CountBadge — a small accent count on an icon (the header Bag). Hidden at
// zero; "99+" past 99.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';
import { useOnGradient } from '../headerInk';

const makeStyles = ({ size, radius, space, colors }: Theme) =>
  StyleSheet.create({
    button: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
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
  });

export const CountBadge: React.FC<{ count: number }> = ({ count }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  // On the gradient header the badge turns white, ringed in the header's own deep accent.
  const onGradient = useOnGradient();
  if (count <= 0) return null;
  return (
    <View
      style={[styles.badge, onGradient ? { backgroundColor: colors.surface, borderColor: service.accentDeep } : { backgroundColor: service.accent }]}
      pointerEvents="none">
      <AppText variant="micro" style={{ color: onGradient ? service.accentDeep : service.onAccent }}>
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
}> = ({ icon, count, onPress, label, tone: toneProp }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const onGradient = useOnGradient();
  const tone = toneProp ?? (onGradient ? 'onScrim' : 'ink');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count} ${count === 1 ? 'item' : 'items'}` : label}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.pressed }]}>
      <IonIcon name={icon} size="lg" color={tone === 'onScrim' ? colors.onScrim : colors.ink} />
      <CountBadge count={count} />
    </Pressable>
  );
};

export default CountBadge;
