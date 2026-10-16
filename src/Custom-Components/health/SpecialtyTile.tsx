// SpecialtyTile — a line icon in a soft accent circle, the English name, the
// Urdu name under it (right to left), and how many doctors there are.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { Specialty } from '../../types/health';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

const makeStyles = ({ colors, space, radius, size }: Theme) =>
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
    well: { width: size.specialtyWell, height: size.specialtyWell, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    ur: { writingDirection: 'rtl' },
  });

export const SpecialtyTile: React.FC<{ specialty: Specialty; onPress: () => void; showCount?: boolean }> = ({ specialty: s, onPress, showCount = true }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}${showCount ? `, ${s.doctorCount} ${s.doctorCount === 1 ? 'doctor' : 'doctors'}` : ''}`}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.well, { backgroundColor: service.accentSoft }]}>
        <IonIcon name={s.icon as IonName} size="lg" color={service.accentDeep} />
      </View>
      <AppText variant="small" align="center" numberOfLines={2}>
        {s.name}
      </AppText>
      {s.nameUr ? (
        <AppText variant="caption" tone="muted" align="center" style={styles.ur} numberOfLines={1}>
          {s.nameUr}
        </AppText>
      ) : null}
      {showCount ? (
        <AppText variant="micro" tone="faint">
          {s.doctorCount} {s.doctorCount === 1 ? 'doctor' : 'doctors'}
        </AppText>
      ) : null}
    </Pressable>
  );
};

export default SpecialtyTile;
