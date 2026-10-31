// SpecialtyTile — a line icon in a soft circle, the name, and how many
// doctors there are. `tint` gives the circle its own colour (the Health
// home's grid, one colour per specialty); `bare` drops the tile's white
// ground when a card around the grid already gives one.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { Specialty } from '../../types/health';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

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
    well: { width: size.specialtyWell, height: size.specialtyWell, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  });

export const SpecialtyTile: React.FC<{
  specialty: Specialty;
  onPress: () => void;
  showCount?: boolean;
  tint?: { fg: string; bg: string };
  bare?: boolean;
}> = ({ specialty: s, onPress, showCount = true, tint, bare }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  const well = tint ?? { fg: service.accentDeep, bg: service.accentSoft };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}${showCount && s.doctorCount > 0 ? `, ${s.doctorCount} ${s.doctorCount === 1 ? 'doctor' : 'doctors'}` : ''}`}
      style={({ pressed }) => [styles.root, bare && styles.bare, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.well, { backgroundColor: well.bg }]}>
        <IonIcon name={s.icon as IonName} size="lg" color={well.fg} />
      </View>
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
