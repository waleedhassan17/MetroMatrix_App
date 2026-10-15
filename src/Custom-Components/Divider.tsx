// Divider — a hairline, optionally split by a word ("or").

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../theme';
import { AppText } from './AppText';

const makeStyles = ({ colors, size, space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    // A plain divider spans its parent's width; it never grows (in a column a
    // flex: 1 hairline would take half the screen).
    line: { alignSelf: 'stretch', height: size.hairline, backgroundColor: colors.line },
    // Either side of a label ("or") in a row.
    split: { flex: 1, height: size.hairline, backgroundColor: colors.line },
  });

export const Divider: React.FC<{ label?: string }> = ({ label }) => {
  const styles = useStyles(makeStyles);
  if (!label) return <View style={styles.line} />;
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.split} />
      <AppText variant="small" tone="faint">
        {label}
      </AppText>
      <View style={styles.split} />
    </View>
  );
};

export default Divider;
