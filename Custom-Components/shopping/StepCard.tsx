// StepCard — where checkout is (the FYP's step card): the steps' names, the
// current one in the accent, and an 8 pt bar that fills as you go. Steps
// already done can be tapped to go back to them.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { ProgressBar } from '../ProgressBar';

export interface StepCardProps {
  steps: string[];
  /** The current step, from 0. */
  index: number;
  /** Go back to a step already done. */
  onStep?: (index: number) => void;
}

const makeStyles = ({ colors, radius, space, size, elevation }: Theme) =>
  StyleSheet.create({
    card: { padding: space.s16, gap: space.s12, borderRadius: radius.xl, backgroundColor: colors.surface, ...elevation.card },
    labels: { flexDirection: 'row', gap: space.s8 },
    step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.touch / 2 },
  });

export const StepCard: React.FC<StepCardProps> = ({ steps, index, onStep }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <View style={styles.card}>
      <View style={styles.labels}>
        {steps.map((label, i) => {
          const done = i < index;
          const current = i === index;
          const text = (
            <>
              {done ? <IonIcon name="checkmark-circle" size="sm" color={service.accent} /> : null}
              <AppText
                variant={current ? 'chip' : 'caption'}
                tone={current ? 'accentDeep' : done ? 'ink' : 'muted'}
                numberOfLines={1}>
                {label}
              </AppText>
            </>
          );
          return done && onStep ? (
            <Pressable
              key={label}
              onPress={() => onStep(i)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Back to ${label}`}
              style={({ pressed }) => [styles.step, pressed && { opacity: opacity.pressed }]}>
              {text}
            </Pressable>
          ) : (
            <View key={label} style={styles.step} accessibilityElementsHidden={!current}>
              {text}
            </View>
          );
        })}
      </View>
      <ProgressBar
        progress={(index + 1) / steps.length}
        thickness="step"
        accessibilityLabel={`Step ${index + 1} of ${steps.length}, ${steps[index] ?? ''}`}
      />
    </View>
  );
};

export default StepCard;
