// TextAction — a quiet inline action ("Edit", "Make default", "Delete"): text
// in the accent (or danger), a full touch target, no button chrome.

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { useOnGradient } from './headerInk';
import { IonIcon, type IonName } from './Icon';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.touch, alignSelf: 'flex-start' },
  });

export const TextAction: React.FC<{
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'muted';
  icon?: IonName;
  disabled?: boolean;
  accessibilityLabel?: string;
}> = ({ label, onPress, tone = 'accent', icon, disabled, accessibilityLabel }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  const onGradient = useOnGradient();
  const color = onGradient
    ? disabled
      ? colors.onScrimSoft
      : colors.onScrim
    : disabled
      ? colors.inkFaint
      : tone === 'danger'
        ? colors.danger
        : tone === 'muted'
          ? colors.inkMuted
          : service.accentDeep;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      {icon ? <IonIcon name={icon} size="sm" color={color} /> : null}
      <AppText variant="small" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
};

export default TextAction;
