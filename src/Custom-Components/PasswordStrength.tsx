// PasswordStrength — four segments and a word, graded by authModel.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { getPasswordStrength, type PasswordStrengthLevel } from '../models/authModel';
import { AppText, type TextTone } from './AppText';

const LEVELS: PasswordStrengthLevel[] = ['weak', 'fair', 'strong', 'excellent'];
const LABEL: Record<PasswordStrengthLevel, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  excellent: 'Excellent',
};
const TONE: Record<PasswordStrengthLevel, TextTone> = {
  weak: 'danger',
  fair: 'warning',
  strong: 'success',
  excellent: 'success',
};

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    track: { flex: 1, flexDirection: 'row', gap: space.s4 },
    segment: { flex: 1, height: size.progress, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
  });

export const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (!password) return null;
  const level = getPasswordStrength(password);
  const filled = LEVELS.indexOf(level) + 1;
  const fill = { danger: colors.danger, warning: colors.warning, success: colors.success }[
    TONE[level] as 'danger' | 'warning' | 'success'
  ];
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Password strength: ${LABEL[level]}`}>
      <View style={styles.track}>
        {LEVELS.map((l, i) => (
          <View key={l} style={[styles.segment, i < filled && { backgroundColor: fill }]} />
        ))}
      </View>
      <AppText variant="small" tone={TONE[level]}>
        {LABEL[level]}
      </AppText>
    </View>
  );
};

export default PasswordStrength;
