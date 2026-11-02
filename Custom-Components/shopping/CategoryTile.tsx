// CategoryTile — a category's glyph in a soft accent well, its name below.
// `photo` is the Shopping home's "Shop by category" tile (the FYP's): an
// 84 × 100 photo, rounded, with the name under it; with no photo the glyph
// sits on the soft accent in the same shape.

import React from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

/** The API picks the glyph; anything Ionicons doesn't know becomes a tag. */
export const categoryIcon = (name: string): IonName =>
  (name in Ionicons.glyphMap ? name : 'pricetag-outline') as IonName;

const makeStyles = ({ colors, radius, space, size, elevation }: Theme) =>
  StyleSheet.create({
    root: { width: size.categoryWell + space.s20, alignItems: 'center', gap: space.s8 },
    well: {
      width: size.categoryWell,
      height: size.categoryWell,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoRoot: { width: size.categoryTile.width, gap: space.s8 },
    photo: {
      width: size.categoryTile.width,
      height: size.categoryTile.height,
      borderRadius: radius.lg,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSunk,
      ...elevation.input,
    },
    image: { width: '100%', height: '100%' },
  });

export const CategoryTile: React.FC<{
  name: string;
  icon: string;
  onPress: () => void;
  selected?: boolean;
  variant?: 'glyph' | 'photo';
  /** The bundled photo for `photo` tiles (Components/shopping/shopPhotos). */
  photo?: ImageSourcePropType | null;
}> = ({ name, icon, onPress, selected, variant = 'glyph', photo }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity, motion } = useTheme();
  if (variant === 'photo') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={({ pressed }) => [styles.photoRoot, pressed && { opacity: opacity.pressed }]}>
        <View style={[styles.photo, !photo && { backgroundColor: service.accentSoft }]}>
          {photo ? (
            <Image source={photo} style={styles.image} contentFit="cover" transition={motion.imageFade} />
          ) : (
            <IonIcon name={categoryIcon(icon)} size="xl" color={service.accentDeep} />
          )}
        </View>
        <AppText variant="small" align="center" numberOfLines={2}>
          {name}
        </AppText>
      </Pressable>
    );
  }
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
