// ═══════════════════════════════════════════════════════
// BrandCard / BrandLogo — the brand list (as the FYP lists brands)
// ═══════════════════════════════════════════════════════
// BrandCard: the brand's cover photo with, on a scrim at its foot, the name,
// one line of tagline, at most two of what it sells in frosted chips, and
// "Shop now" in the brand's own colour: the photo stays the hero. A brand with
// no cover gets its own colour instead.
// BrandLogo: the round logo in a ring of the brand's colour, name below
// ("Featured brands").

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { storePalette, useStyles, useTheme, type Theme } from '../../theme';
import type { StoreSummary } from '../../models/shopping';
import { cdn } from '../../utils/cdn/cdn';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { PhotoScrim } from '../PhotoScrim';
import { storeInitials } from './StoreCard';

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    card: { height: size.brandCard, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.ink, ...elevation.raised },
    image: { ...StyleSheet.absoluteFillObject },
    body: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: space.s20, gap: space.s4 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8, marginTop: space.s8 },
    chips: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexShrink: 1, overflow: 'hidden' },
    // The FYP's frosted chip: a white wash with a white line, on the scrim.
    chip: {
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      borderWidth: size.border,
      borderColor: colors.onScrimLine,
      backgroundColor: colors.onScrimTint,
    },
    shop: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s16, paddingVertical: space.s8, borderRadius: radius.pill, flexShrink: 0 },
    paused: { position: 'absolute', top: space.s12, left: space.s12, paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.sm, backgroundColor: colors.glass },
    logoCell: { width: size.brandRing + space.s16, alignItems: 'center', gap: space.s8 },
    ring: {
      width: size.brandRing,
      height: size.brandRing,
      borderRadius: radius.pill,
      borderWidth: size.focusBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    inner: { width: size.brandRingInner, height: size.brandRingInner, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  });

export const BrandCard: React.FC<{ brand: StoreSummary; onPress: () => void }> = ({ brand, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity, size, motion, type } = useTheme();
  const palette = storePalette(brand.brandColor, brand.onBrandColor);
  const cover = cdn(brand.coverUrl, { w: size.storeCard * 1.5, h: size.brandCard });
  const shown = brand.categories.slice(0, 2);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${brand.name}. ${brand.tagline}. ${brand.categories.join(', ')}. Shop now`}
      style={({ pressed }) => [styles.card, !cover && { backgroundColor: palette.accent }, pressed && { opacity: opacity.pressed }]}>
      {cover ? (
        <>
          <Image source={{ uri: cover }} style={styles.image} contentFit="cover" transition={motion.imageFade} />
          <PhotoScrim strength="strong" />
        </>
      ) : null}
      {brand.isPaused ? (
        <View style={styles.paused}>
          <AppText variant="chip">Taking a break</AppText>
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="cardTitle" tone="onScrim" numberOfLines={1}>
          {brand.name}
        </AppText>
        {brand.tagline ? (
          <AppText variant="small" numberOfLines={1} style={{ color: colors.onScrimSoft }}>
            {brand.tagline}
          </AppText>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.chips}>
            {shown.map(c => (
              <View key={c} style={styles.chip}>
                <AppText variant="chip" tone="onScrim" numberOfLines={1}>
                  {c}
                </AppText>
              </View>
            ))}
          </View>
          <View style={[styles.shop, { backgroundColor: cover ? palette.accent : colors.glass }]}>
            <AppText style={[type.chip, { color: cover ? palette.onAccent : colors.ink }]}>Shop now</AppText>
            <IonIcon name="chevron-forward" size="sm" color={cover ? palette.onAccent : colors.ink} />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export const BrandLogo: React.FC<{ brand: StoreSummary; onPress: () => void }> = ({ brand, onPress }) => {
  const styles = useStyles(makeStyles);
  const { opacity, size, type } = useTheme();
  const palette = storePalette(brand.brandColor, brand.onBrandColor);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={brand.name}
      style={({ pressed }) => [styles.logoCell, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.ring, { borderColor: palette.accent }]}>
        <View style={[styles.inner, { backgroundColor: palette.accent }]}>
          {brand.logoUrl ? (
            <Image source={{ uri: cdn(brand.logoUrl, { w: size.brandRingInner, h: size.brandRingInner }) ?? undefined }} style={styles.image} contentFit="cover" />
          ) : (
            <AppText style={[type.title, { color: palette.onAccent }]}>{storeInitials(brand.name)}</AppText>
          )}
        </View>
      </View>
      <AppText variant="caption" tone="muted" align="center" numberOfLines={1}>
        {brand.name}
      </AppText>
    </Pressable>
  );
};

