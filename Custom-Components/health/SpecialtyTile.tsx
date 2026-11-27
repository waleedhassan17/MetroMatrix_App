// SpecialtyTile — a line icon in a neutral well, the name, and how many
// doctors there are. Every specialty wears the same grey well (no colour per
// specialty: the owner, 2026-11-27); `bare` drops the tile's white ground
// when a card around the grid already gives one.

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { Specialty } from '../../models/health';
import { AppText } from '../AppText';
import { type IonName } from '../Icon';
import { IconWell } from '../IconWell';

const makeStyles = ({ colors, space, radius, size, type }: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s12,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      minHeight: size.touch,
    },
    bare: { backgroundColor: 'transparent', paddingHorizontal: space.s0 },
    name: { minHeight: Number(type.small.lineHeight) * 2 },
  });

export const SpecialtyTile: React.FC<{
  specialty: Specialty;
  onPress: () => void;
  showCount?: boolean;
  bare?: boolean;
}> = ({ specialty: s, onPress, showCount = true, bare }) => {
  const styles = useStyles(makeStyles);
  const { opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}${showCount && s.doctorCount > 0 ? `, ${s.doctorCount} ${s.doctorCount === 1 ? 'doctor' : 'doctors'}` : ''}`}
      style={({ pressed }) => [styles.root, bare && styles.bare, pressed && { opacity: opacity.pressed }]}>
      <IconWell icon={s.icon as IonName} size="lg" />
      <AppText variant="small" align="center" numberOfLines={2} style={bare ? styles.name : undefined}>
        {s.name}
      </AppText>
      {showCount && s.doctorCount > 0 ? (
        <AppText variant="micro" tone="faint">
          {s.doctorCount} {s.doctorCount === 1 ? 'doctor' : 'doctors'}
        </AppText>
      ) : null}
    </Pressable>
  );
};

export default SpecialtyTile;
