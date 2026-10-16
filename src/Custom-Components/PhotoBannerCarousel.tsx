// ═══════════════════════════════════════════════════════
// PhotoBannerCarousel — a module's promotions, one photo card at a time
// ═══════════════════════════════════════════════════════
// Shopping's and Health's banners: a photo under a legibility scrim with a
// headline, a line under it and an optional call to action. Advances every
// 6 s (never under reduced motion, or while a screen reader runs); a touch
// pauses it until the finger lifts; page dots under it. It
// brings its own side gutter, so it sits full width in a padded page with
// `bleed`. Remote photos go through cdn() at the rendered size.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useCalmMotion } from '../hooks/useCalmMotion';
import { useStyles, useTheme, type Theme } from '../theme';
import { cdn } from '../utils/cdn';
import { AppText } from './AppText';
import { IonIcon } from './Icon';
import { PhotoScrim } from './PhotoScrim';

export interface PhotoBanner {
  id: string;
  imageUrl: string;
  headline: string;
  subhead: string | null;
}

export interface PhotoBannerCarouselProps<T extends PhotoBanner> {
  banners: T[];
  onOpen: (banner: T) => void;
  /** A short call to action on every card ("Book now"), or one per banner (null: none). */
  cta?: string | ((banner: T) => string | null);
  /** Inside a padded page: cancel the page's gutter so the rail runs edge to edge. */
  bleed?: boolean;
}

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    bleed: { marginHorizontal: -gutter },
    card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    text: {
      position: 'absolute',
      left: space.s20,
      right: space.s20,
      bottom: space.s20,
      gap: space.s4,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: space.s4,
      marginTop: space.s8,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: space.s4, paddingTop: space.s8 },
    dot: {
      width: size.pageDot,
      height: size.pageDot,
      borderRadius: radius.pill,
      backgroundColor: colors.line,
    },
  });

export function PhotoBannerCarousel<T extends PhotoBanner>({
  banners,
  onOpen,
  cta,
  bleed,
}: PhotoBannerCarouselProps<T>) {
  const styles = useStyles(makeStyles);
  const { gutter, space, size, motion, colors, service } = useTheme();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const calm = useCalmMotion();
  const cardWidth = Math.min(width, 640) - gutter * 2;
  const pitch = cardWidth + space.s12;

  useEffect(() => {
    if (held || calm || banners.length < 2) return;
    const t = setInterval(() => {
      setIndex(i => {
        const next = (i + 1) % banners.length;
        ref.current?.scrollTo({ x: next * pitch, animated: true });
        return next;
      });
    }, motion.bannerInterval);
    return () => clearInterval(t);
  }, [held, calm, banners.length, pitch, motion.bannerInterval]);

  if (!banners.length) return null;
  return (
    <View style={bleed ? styles.bleed : null}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={pitch}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: gutter, gap: space.s12 }}
        onTouchStart={() => setHeld(true)}
        onTouchEnd={() => setHeld(false)}
        onScrollBeginDrag={() => setHeld(true)}
        onMomentumScrollEnd={e => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / pitch));
          setHeld(false);
        }}>
        {banners.map(b => {
          const action = typeof cta === 'function' ? cta(b) : cta;
          return (
            <Pressable
              key={b.id}
              onPress={() => onOpen(b)}
              accessibilityRole="button"
              accessibilityLabel={[b.headline, b.subhead, action].filter(Boolean).join('. ')}
              style={[styles.card, { width: cardWidth, aspectRatio: size.bannerAspect }]}>
              <Image
                source={{
                  uri:
                    cdn(b.imageUrl, { w: cardWidth, h: cardWidth / size.bannerAspect }) ??
                    undefined,
                }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={motion.imageFade}
              />
              <PhotoScrim strength="strong" />
              <View style={styles.text}>
                <AppText variant="h2" tone="onScrim" numberOfLines={2}>
                  {b.headline}
                </AppText>
                {b.subhead ? (
                  <AppText variant="small" numberOfLines={2} style={{ color: colors.onScrimSoft }}>
                    {b.subhead}
                  </AppText>
                ) : null}
                {action ? (
                  <View style={styles.cta}>
                    <AppText variant="chip" style={{ color: service.accentDeep }}>
                      {action}
                    </AppText>
                    <IonIcon name="arrow-forward" size="sm" color={service.accentDeep} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {banners.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={[
                styles.dot,
                i === index && { backgroundColor: service.accent, width: size.pageDotActive },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default PhotoBannerCarousel;
