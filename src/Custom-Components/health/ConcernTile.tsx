// ConcernTile — a common concern as a round, coloured icon with its name
// under it (acne, fever, back pain …). The icon is its specialty's, so a
// patient who knows only how they feel lands with the right doctors.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

const makeStyles = ({ space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { width: size.specialtyWell + space.s24, alignItems: 'center', gap: space.s8 },
    well: { width: size.specialtyWell, height: size.specialtyWell, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  });

export const ConcernTile: React.FC<{ name: string; icon: IonName; tint: { fg: string; bg: string }; onPress: () => void }> = ({ name, icon, tint, onPress }) => {
  const styles = useStyles(makeStyles);
  const { opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. Doctors who treat it`}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.well, { backgroundColor: tint.bg }]}>
        <IonIcon name={icon} size="lg" color={tint.fg} />
      </View>
      <AppText variant="caption" align="center" numberOfLines={2}>
        {name}
      </AppText>
    </Pressable>
  );
};

export default ConcernTile;
