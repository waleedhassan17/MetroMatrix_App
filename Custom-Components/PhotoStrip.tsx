// PhotoStrip — the photos a form attaches (a review, a return, a payment
// screenshot): thumbnails with a remove button, then an "Add photo" tile
// until the limit. A photo still uploading shows its progress.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IonIcon } from './Icon';

export interface StripPhoto {
  key: string;
  uri: string;
  /** 0..1 while uploading; null once stored. */
  progress: number | null;
}

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { gap: space.s8 },
    tile: {
      width: size.tile,
      height: size.tile,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSunk,
    },
    image: { width: '100%', height: '100%' },
    remove: {
      position: 'absolute',
      top: space.s4,
      right: space.s4,
      width: size.icon.lg,
      height: size.icon.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progress: { position: 'absolute', left: 0, bottom: 0, height: size.progress },
    add: {
      width: size.tile,
      height: size.tile,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s4,
    },
  });

export const PhotoStrip: React.FC<{
  photos: StripPhoto[];
  max: number;
  onAdd: () => void;
  onRemove: (key: string) => void;
  addLabel?: string;
}> = ({ photos, max, onAdd, onRemove, addLabel = 'Add photo' }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {photos.map((p, i) => (
        <View key={p.key}>
          <View style={styles.tile}>
            <Image source={{ uri: p.uri }} style={styles.image} contentFit="cover" />
            {p.progress !== null ? (
              <View style={[styles.progress, { width: `${Math.round(p.progress * 100)}%`, backgroundColor: service.accent }]} />
            ) : null}
          </View>
          <Pressable
            onPress={() => onRemove(p.key)}
            style={styles.remove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${i + 1}`}>
            <IonIcon name="close" size="sm" color={colors.ink} />
          </Pressable>
        </View>
      ))}
      {photos.length < max ? (
        <Pressable onPress={onAdd} style={styles.add} accessibilityRole="button" accessibilityLabel={`${addLabel}, ${photos.length} of ${max}`}>
          <IonIcon name="camera-outline" size="md" color={service.accentDeep} />
          <AppText variant="micro" tone="muted">
            {photos.length}/{max}
          </AppText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
};

export default PhotoStrip;
