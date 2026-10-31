// PhotoTile — one of Health's own services as a small photo card (records,
// prescriptions, family …): the photo on top, the name under it. The
// emergency tile's name is the one red word on the page.

import React from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    root: {
      width: size.photoTile.width,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    photo: {
      height: size.photoTile.image,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSunk,
    },
    label: { paddingHorizontal: space.s8, paddingVertical: space.s8, minHeight: size.touch, justifyContent: 'center' },
  });

export const PhotoTile: React.FC<{ label: string; image: ImageSourcePropType; onPress: () => void; tone?: 'danger' }> = ({ label, image, onPress, tone }) => {
  const styles = useStyles(makeStyles);
  const { opacity, motion } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      <View style={styles.photo}>
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={motion.imageFade} />
      </View>
      <View style={styles.label}>
        <AppText variant="chip" tone={tone === 'danger' ? 'danger' : 'ink'} align="center" numberOfLines={2}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
};

export default PhotoTile;
