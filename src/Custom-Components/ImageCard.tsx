// ImageCard — a photo with a title under it. expo-image caches and fades in.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';

export interface ImageCardProps {
  /** A remote URI or a bundled asset (require()). */
  image: string | number;
  title: string;
  subtitle?: string;
  aspectRatio?: number;
  onPress?: () => void;
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    text: { gap: space.s4 },
  });

export const ImageCard: React.FC<ImageCardProps> = ({ image, title, subtitle, aspectRatio = 4 / 3, onPress }) => {
  const styles = useStyles(makeStyles);
  const { motion } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={styles.root}>
      <Image source={typeof image === 'string' ? { uri: image } : image} style={[styles.image, { aspectRatio }]} contentFit="cover" transition={motion.press.duration} />
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
};

export default ImageCard;
