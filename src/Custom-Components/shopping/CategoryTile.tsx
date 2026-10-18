// CategoryTile — a category's glyph in a soft accent well, its name below.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

/** The API picks the glyph; anything Ionicons doesn't know becomes a tag. */
export const categoryIcon = (name: string): IonName =>
  (name in Ionicons.glyphMap ? name : 'pricetag-outline') as IonName;

const makeStyles = ({ radius, space, size }: Theme) =>
  StyleSheet.create({
    root: { width: size.categoryWell + space.s20, alignItems: 'center', gap: space.s8 },
    well: {
      width: size.categoryWell,
      height: size.categoryWell,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const CategoryTile: React.FC<{ name: string; icon: string; onPress: () => void; selected?: boolean }> = ({
  name,
  icon,
  onPress,
  selected,
}) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      aria-selected={!!selected}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.well, { backgroundColor: selected ? service.accent : service.accentSoft }]}>
        <IonIcon name={categoryIcon(icon)} size="lg" color={selected ? service.onAccent : service.accentDeep} />
      </View>
      <AppText variant="caption" align="center" numberOfLines={2}>
        {name}
      </AppText>
    </Pressable>
  );
};

export default CategoryTile;
