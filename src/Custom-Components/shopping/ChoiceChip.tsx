// ChoiceChip — one selectable option: a size, a filter, a reason. Selected
// fills with the accent; an unavailable option is struck through and can't
// be chosen (but stays readable, so a shopper knows it exists).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

export interface ChoiceChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon?: IonName;
  /** A colour dot before the label (a colour option). */
  swatch?: string;
  accessibilityHint?: string;
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      minHeight: size.control.sm,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    struck: { textDecorationLine: 'line-through' },
    dot: { width: size.icon.md, height: size.icon.md, borderRadius: radius.pill, borderWidth: size.hairline, borderColor: colors.lineStrong },
  });

export const ChoiceChip: React.FC<ChoiceChipProps> = ({ label, selected, disabled, onPress, icon, swatch, accessibilityHint }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${label}, unavailable` : label}
      accessibilityHint={accessibilityHint}
      aria-selected={!!selected}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        styles.root,
        selected && { backgroundColor: service.accent, borderColor: service.accent },
        disabled && { backgroundColor: colors.surfaceSunk, borderColor: colors.lineSoft },
        pressed && { opacity: opacity.pressed },
      ]}>
      {swatch ? <View style={[styles.dot, { backgroundColor: swatch }]} /> : null}
      {icon ? <IonIcon name={icon} size="sm" color={selected ? service.onAccent : colors.inkMuted} /> : null}
      <AppText
        variant="small"
        tone={selected ? 'onAccent' : disabled ? 'faint' : 'ink'}
        style={disabled ? styles.struck : undefined}
        numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
};

export default ChoiceChip;
