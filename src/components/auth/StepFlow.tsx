// ═══════════════════════════════════════════════════════
// MetroMatrix — Multi-step form chrome (the FYP's ProgressIndicator +
// NavigationButtons), shared by Complete Profile and Personal Info.
// ═══════════════════════════════════════════════════════

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { Button } from '../../Custom-Components/Button';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    progress: { gap: space.s12 },
    track: { height: size.progress, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: space.s8 },
    dot: { width: size.pageDot, height: size.pageDot, borderRadius: radius.pill },
    buttons: { flexDirection: 'row', gap: space.s12 },
    grow: { flex: 1 },
    pills: { flexDirection: 'row', gap: space.s12 },
    pill: {
      flex: 1,
      minHeight: size.control.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: size.border,
    },
    group: { gap: space.s8 },
    stepHead: { gap: space.s4 },
  });

/** The bar fills by step; the dots light up to the current step. */
export const StepProgress: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(current / total) * 100}%`, backgroundColor: service.accent }]} />
      </View>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < current ? service.accent : colors.line }]} />
        ))}
      </View>
    </View>
  );
};

/** A step's own title and one-line description. */
export const StepHeading: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stepHead}>
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" tone="muted">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
};

/** Back (outlined) beside the primary step action; Back hides on step 1. */
export const StepButtons: React.FC<{
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  disabled?: boolean;
  loading?: boolean;
}> = ({ onBack, onNext, nextLabel, disabled, loading }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.buttons}>
      {onBack ? (
        <View style={styles.grow}>
          <Button label="Back" variant="secondary" onPress={onBack} disabled={loading} fullWidth />
        </View>
      ) : null}
      <View style={styles.grow}>
        <Button label={nextLabel} onPress={onNext} disabled={disabled} loading={loading} fullWidth />
      </View>
    </View>
  );
};

/** The FYP's row of equal option pills (gender, yes/no). */
export function OptionPills<V extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  error?: string;
}) {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="label" tone={error ? 'danger' : 'ink'}>
        {label}
      </AppText>
      <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.pill,
                {
                  backgroundColor: on ? service.accentSoft : colors.surface,
                  borderColor: on ? service.accent : error ? colors.danger : colors.line,
                },
              ]}>
              <AppText variant="label" tone={on ? 'accentDeep' : 'muted'}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
