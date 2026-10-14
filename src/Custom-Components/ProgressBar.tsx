// ProgressBar — a thin determinate bar (uploads).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';

const makeStyles = ({ colors, size, radius }: Theme) =>
  StyleSheet.create({
    track: { height: size.progress, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
  });

export const ProgressBar: React.FC<{ progress: number; accessibilityLabel?: string }> = ({
  progress,
  accessibilityLabel = 'Progress',
}) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: service.accent }]} />
    </View>
  );
};

export default ProgressBar;
