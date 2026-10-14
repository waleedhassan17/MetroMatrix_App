// StickyCTA — the one primary action, pinned above the home indicator.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';

const makeStyles = ({ colors, space, elevation, gutter }: Theme) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.surface,
      paddingHorizontal: gutter,
      paddingTop: space.s16,
      gap: space.s8,
      ...elevation.float,
    },
  });

export const StickyCTA: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const styles = useStyles(makeStyles);
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, space.s16) }]}>{children}</View>
  );
};

export default StickyCTA;
