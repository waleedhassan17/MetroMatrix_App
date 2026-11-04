// IconButton — a 44 pt touch target around one glyph (back, close, actions).
// On a gradient header whose theme asks for circles (Shopping), or with
// `appearance="circle"` (floating over a photo), the glyph sits in ink in a
// 40 pt white circle, the FYP's ShoppingHeaderAction; its slop keeps 44.

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { IonIcon, type IonName } from './Icon';
import { useOnGradient } from './headerInk';

export interface IconButtonProps {
  icon: IonName;
  onPress: () => void;
  accessibilityLabel: string;
  /** `danger`: a filled, chosen state in red (a saved heart). */
  tone?: 'ink' | 'muted' | 'onScrim' | 'danger';
  /** `circle`: the white circle off the header too (over a photo, lifted). */
  appearance?: 'plain' | 'circle';
  disabled?: boolean;
}

const makeStyles = ({ size, radius, colors }: Theme) =>
  StyleSheet.create({
    root: {
      width: size.touch,
      height: size.touch,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circle: {
      width: size.headerWell,
      height: size.headerWell,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
  });

/** Whether an action here wears the white circle: Shopping's header, or asked for. */
export const useCircleAction = (appearance?: 'plain' | 'circle') => {
  const { header } = useTheme();
  const onGradient = useOnGradient();
  return appearance === 'circle' || (appearance !== 'plain' && onGradient && header.actions === 'circle');
};

/** The circle's slop: 40 pt drawn, 44 pt to touch. */
export const CIRCLE_SLOP = 2;

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  tone: toneProp,
  appearance,
  disabled,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity, elevation } = useTheme();
  const onGradient = useOnGradient();
  // An explicit tone (the header's back glyph) stays a bare glyph, unless a circle is asked for.
  const circle = useCircleAction(toneProp && appearance !== 'circle' ? 'plain' : appearance);
  if (circle) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={CIRCLE_SLOP}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        aria-disabled={!!disabled}
        style={({ pressed }) => [
          styles.circle,
          !onGradient && elevation.raised,
          pressed && { opacity: opacity.pressed },
          disabled && { opacity: opacity.disabled },
        ]}>
        <IonIcon name={icon} size="md" color={toneProp === 'danger' ? colors.danger : colors.ink} />
      </Pressable>
    );
  }
  const tone = toneProp ?? (onGradient ? 'onScrim' : 'ink');
  const color =
    tone === 'muted' ? colors.inkMuted : tone === 'onScrim' ? colors.onScrim : tone === 'danger' ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        styles.root,
        pressed && { backgroundColor: onGradient ? colors.onScrimTint : colors.surfaceSunk },
        disabled && { opacity: opacity.disabled },
      ]}>
      <IonIcon name={icon} size="lg" color={color} />
    </Pressable>
  );
};

export default IconButton;
