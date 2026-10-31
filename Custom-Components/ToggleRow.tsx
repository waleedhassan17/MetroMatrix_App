// ToggleRow — a label (and optional line of help) with a switch on the right.

import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';

export interface ToggleRowProps {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.control.md },
    text: { flex: 1, gap: space.s4 },
  });

export const ToggleRow: React.FC<ToggleRowProps> = ({ label, helper, value, onChange, disabled }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={helper}
      aria-checked={value}
      aria-disabled={!!disabled}
      style={styles.root}>
      <View style={styles.text}>
        <AppText variant="bodyStrong" tone={disabled ? 'faint' : 'ink'}>
          {label}
        </AppText>
        {helper ? (
          <AppText variant="small" tone="muted">
            {helper}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.disabled, true: service.accent }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.disabled}
        // react-native-web paints its own teal thumb when on unless told otherwise.
        {...({ activeThumbColor: colors.surface } as object)}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
};

export default ToggleRow;
