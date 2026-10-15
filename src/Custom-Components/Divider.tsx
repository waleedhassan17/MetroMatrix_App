// Divider — a hairline, optionally split by a word ("or").

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../theme';
import { AppText } from './AppText';

const makeStyles = ({ colors, size, space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    line: { flex: 1, height: size.hairline, backgroundColor: colors.line },
  });

export const Divider: React.FC<{ label?: string }> = ({ label }) => {
  const styles = useStyles(makeStyles);
  if (!label) return <View style={styles.line} />;
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.line} />
      <AppText variant="small" tone="faint">
        {label}
      </AppText>
      <View style={styles.line} />
    </View>
  );
};

export default Divider;
