// QuantityStepper — − n +, clamped to [min, max]. An adjustable control for
// screen readers (swipe up / down changes it).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { haptics } from '../../utils/haptics';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** "Quantity of Rouge kurta" */
  label?: string;
  compact?: boolean;
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    button: { width: size.touch, height: size.control.sm, alignItems: 'center', justifyContent: 'center' },
    value: { minWidth: space.s24, alignItems: 'center' },
  });

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
  label = 'Quantity',
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const set = (next: number) => {
    const n = Math.max(min, Math.min(max, next));
    if (n !== value) {
      haptics.press();
      onChange(n);
    }
  };
  const canDown = !disabled && value > min;
  const canUp = !disabled && value < max;
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}>
      <Pressable
        onPress={() => set(value - 1)}
        disabled={!canDown}
        accessibilityLabel="Fewer"
        style={({ pressed }) => [styles.button, pressed && { opacity: opacity.pressed }]}>
        <IonIcon name="remove" size="md" color={canDown ? colors.ink : colors.inkFaint} />
      </Pressable>
      <View style={styles.value}>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
      <Pressable
        onPress={() => set(value + 1)}
        disabled={!canUp}
        accessibilityLabel="More"
        style={({ pressed }) => [styles.button, pressed && { opacity: opacity.pressed }]}>
        <IonIcon name="add" size="md" color={canUp ? colors.ink : colors.inkFaint} />
      </Pressable>
    </View>
  );
};

export default QuantityStepper;
