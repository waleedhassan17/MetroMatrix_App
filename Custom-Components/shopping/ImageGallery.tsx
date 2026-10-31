// ═══════════════════════════════════════════════════════
// ImageGallery — the product's photos, full width, paged, then zoomable
// ═══════════════════════════════════════════════════════
// Swipe between photos (4:5); the dots say where you are; a tap opens the
// photo full screen with pinch-to-zoom (ImageViewer).

import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { cdn } from '../../utils/cdn/cdn';
import { AppText } from '../AppText';
import { ImageViewer } from '../ImageViewer';

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    image: { aspectRatio: size.productAspect, backgroundColor: colors.surfaceSunk },
    dots: {
      position: 'absolute',
      bottom: space.s12,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: space.s4,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.glass,
    },
    dot: { width: size.pageDot, height: size.pageDot, borderRadius: radius.pill, backgroundColor: colors.line },
    badge: {
      position: 'absolute',
      top: space.s16,
      left: space.s16,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
  });

export const ImageGallery: React.FC<{ images: string[]; title: string; badge?: string | null; width?: number }> = ({
  images,
  title,
  badge,
  width: fixed,
}) => {
  const styles = useStyles(makeStyles);
  const { service, colors, size, motion } = useTheme();
  const window = useWindowDimensions();
  const width = fixed ?? window.width;
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const photos = images.length ? images : [''];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, i) => `${i}-${uri}`}
        onScroll={onScroll}
        scrollEventThrottle={32}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => item && setViewing(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${title}, photo ${i + 1} of ${photos.length}. Open full screen`}>
            {item ? (
              <Image
                source={{ uri: cdn(item, { w: width, h: width / size.productAspect }) ?? undefined }}
                style={[styles.image, { width }]}
                contentFit="cover"
                transition={motion.imageFade}
              />
            ) : (
              <View style={[styles.image, { width }]} />
            )}
          </Pressable>
        )}
      />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: service.accent }]}>
          <AppText variant="chip" tone="onAccent">
            {badge}
          </AppText>
        </View>
      ) : null}
      {photos.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && { backgroundColor: colors.ink }]} />
          ))}
        </View>
      ) : null}
      <ImageViewer visible={!!viewing} uri={viewing} title={title} onClose={() => setViewing(null)} />
    </View>
  );
};

export default ImageGallery;
