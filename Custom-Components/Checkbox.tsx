// Checkbox — a box and a label; the whole row is the target.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export interface CheckboxProps {
  checked: boolean;
  onToggle: (next: boolean) => void;
  label: React.ReactNode;
  accessibilityLabel: string;
  error?: string;
}

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12, minHeight: size.touch },
    box: {
      width: size.checkbox,
      height: size.checkbox,
      borderRadius: radius.sm,
      borderWidth: size.focusBorder,
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: space.s0,
    },
    label: { flex: 1, gap: space.s4 },
  });

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onToggle, label, accessibilityLabel, error }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={error}
      style={styles.row}>
      <View
        style={[
          styles.box,
          checked && { backgroundColor: service.accent, borderColor: service.accent },
          error && !checked && { borderColor: colors.danger },
        ]}>
        {checked ? <Icon name="check" size="sm" color={service.onAccent} /> : null}
      </View>
      <View style={styles.label}>
        {typeof label === 'string' ? <AppText variant="body">{label}</AppText> : label}
        {error ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
};

export default Checkbox;
