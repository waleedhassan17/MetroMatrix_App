// ConcernTile — a common concern as its icon in a neutral well with its
// name under it (acne, fever, back pain …). The icon is its specialty's, so a
// patient who knows only how they feel lands with the right doctors.

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { type IonName } from '../Icon';
import { IconWell } from '../IconWell';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    root: { width: size.well.lg + space.s24, alignItems: 'center', gap: space.s8 },
  });

export const ConcernTile: React.FC<{ name: string; icon: IonName; onPress: () => void }> = ({ name, icon, onPress }) => {
  const styles = useStyles(makeStyles);
  const { opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. Doctors who treat it`}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      <IconWell icon={icon} size="lg" />
      <AppText variant="caption" align="center" numberOfLines={2}>
        {name}
      </AppText>
    </Pressable>
  );
};

export default ConcernTile;
