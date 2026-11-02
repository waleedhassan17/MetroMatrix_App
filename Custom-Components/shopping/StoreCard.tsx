// StoreCard — a store's cover, its mark in its own colour, name and facts.
// `rail` is the home's horizontal card; `row` is the Stores list.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { storePalette, useStyles, useTheme, type Theme } from '../../theme';
import type { StoreSummary } from '../../models/shopping';
import { cdn } from '../../utils/cdn/cdn';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';

const makeStyles = ({ colors, radius, space, size, elevation }: Theme) =>
  StyleSheet.create({
    rail: { width: size.storeCard, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...elevation.card },
    cover: { width: '100%', aspectRatio: size.coverAspect, backgroundColor: colors.surfaceSunk },
    body: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    text: { flex: 1, gap: space.s4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: space.s4, flexWrap: 'wrap' },
    mark: {
      width: size.storeLogo,
      height: size.storeLogo,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    // The hero's mark sits in a white ring on a photo or the gradient.
    ring: { borderWidth: size.avatarRing, borderColor: colors.surface },
    logo: { width: '100%', height: '100%' },
    featured: {
      position: 'absolute',
      top: space.s8,
      left: space.s8,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
      backgroundColor: colors.glass,
    },
  });

/** "Lawn & Loom" → "LL": the first letter of up to two words (symbols skipped). */
export const storeInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(w => /[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map(w => (w.match(/[A-Za-z0-9]/) ?? [''])[0].toUpperCase())
    .join('');

export type StoreMarkSize = 'sm' | 'md' | 'lg' | 'hero';

/**
 * A store's logo, or its initials on its brand colour: one round mark
 * everywhere (28 in a list's head row, 40 in a card, 56 on a page, and the
 * 52 hero mark in a white ring on a cover or the gradient header).
 */
export const StoreMark: React.FC<{
  store: Pick<StoreSummary, 'name' | 'logoUrl' | 'brandColor'> & { onBrandColor?: string | null };
  size?: StoreMarkSize;
}> = ({ store, size: markSize = 'lg' }) => {
  const styles = useStyles(makeStyles);
  const { size, type } = useTheme();
  const palette = storePalette(store.brandColor, store.onBrandColor);
  const which = markSize;
  const side = { sm: size.storeLogoSmall, md: size.logoMark, lg: size.storeLogo, hero: size.brandRingInner }[which];
  const initials = which === 'sm' ? type.micro : which === 'md' ? type.chip : type.title;
  return (
    <View
      style={[styles.mark, which === 'hero' && styles.ring, { width: side, height: side, backgroundColor: palette.accent }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {store.logoUrl ? (
        <Image source={{ uri: cdn(store.logoUrl, { w: side * 2, h: side * 2 }) ?? undefined }} style={styles.logo} contentFit="cover" />
      ) : (
        <AppText style={[initials, { color: palette.onAccent }]}>{storeInitials(store.name)}</AppText>
      )}
    </View>
  );
};

export const StoreCard: React.FC<{ store: StoreSummary; onPress: () => void; variant?: 'rail' | 'row' }> = ({
  store,
  onPress,
  variant = 'rail',
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity, size, motion } = useTheme();
  const facts = (
    <View style={styles.meta}>
      {store.ratingCount > 0 ? (
        <>
          <IonIcon name="star" size="sm" color={colors.star} />
          <AppText variant="caption" tone="muted">
            {store.rating.toFixed(1)} · {store.city}
          </AppText>
        </>
      ) : (
        <AppText variant="caption" tone="muted">
          {store.city}
        </AppText>
      )}
      {store.isPaused ? (
        <AppText variant="caption" tone="warning">
          · Taking a break
        </AppText>
      ) : null}
    </View>
  );
  const label = `${store.name}, ${store.tagline}, ${store.city}${store.isPaused ? ', taking a break' : ''}`;

  if (variant === 'row') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}>
        <StoreMark store={store} />
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={1}>
            {store.name}
          </AppText>
          {store.tagline ? (
            <AppText variant="small" tone="muted" numberOfLines={1}>
              {store.tagline}
            </AppText>
          ) : null}
          {facts}
        </View>
        <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
      </Pressable>
    );
  }

  const cover = cdn(store.coverUrl, { w: size.storeCard, h: size.storeCard / size.coverAspect });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.rail, pressed && { opacity: opacity.pressed }]}>
      <View>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={motion.imageFade} />
        ) : (
          <View style={styles.cover} />
        )}
        {store.isFeatured ? (
          <View style={styles.featured}>
            <AppText variant="tag">FEATURED</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <StoreMark store={store} size="md" />
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={1}>
            {store.name}
          </AppText>
          {facts}
        </View>
      </View>
    </Pressable>
  );
};

export default StoreCard;
