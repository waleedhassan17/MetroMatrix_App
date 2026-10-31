// IconButton — a 44 pt touch target around one glyph (back, close, actions).

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { IonIcon, type IonName } from './Icon';
import { useOnGradient } from './headerInk';

export interface IconButtonProps {
  icon: IonName;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'ink' | 'muted' | 'onScrim';
  disabled?: boolean;
}

const makeStyles = ({ size, radius }: Theme) =>
  StyleSheet.create({
    root: {
      width: size.touch,
      height: size.touch,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  tone: toneProp,
  disabled,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const onGradient = useOnGradient();
  const tone = toneProp ?? (onGradient ? 'onScrim' : 'ink');
  const color =
    tone === 'muted' ? colors.inkMuted : tone === 'onScrim' ? colors.onScrim : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        styles.root,
        pressed && { backgroundColor: colors.surfaceSunk },
        disabled && { opacity: opacity.disabled },
      ]}>
      <IonIcon name={icon} size="lg" color={color} />
    </Pressable>
  );
};

export default IconButton;
