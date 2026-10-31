// VendorCard — a Food Court vendor as lists and rails show it: its food
// photo with its mark, a deal ribbon, the rating, cuisines and price level,
// and the time, fee and distance to the customer. A closed or paused vendor
// says when it opens over its photo. `compact` is the narrower rail card.

import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { BadgeRow } from '../kitchen/BadgeRow';
import { cdn } from '../../utils/cdn/cdn';
import { cardLine, closedLabel, cuisineLine, ratingLabel } from '../../models/food/discoveryModel';
import type { VendorCard as VendorCardData } from '../../models/food';

export interface VendorCardProps {
  vendor: VendorCardData;
  onPress: () => void;
  compact?: boolean;
  /** Showing pick-up places: the line says the ready time, not delivery. */
  pickup?: boolean;
}

const makeStyles = ({ colors, space, size, radius, elevation, gutter }: Theme) =>
  StyleSheet.create({
    card: { marginHorizontal: gutter, gap: space.s12 },
    compact: { width: size.kitchenTile, gap: space.s8 },
    photo: { width: '100%', aspectRatio: size.vendorPhotoAspect, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    railPhoto: { aspectRatio: size.railPhotoAspect },
    fill: { ...StyleSheet.absoluteFillObject },
    closed: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrimMid, alignItems: 'center', justifyContent: 'center', padding: space.s12 },
    ribbon: {
      position: 'absolute',
      top: space.s12,
      left: space.s0,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderTopRightRadius: radius.pill,
      borderBottomRightRadius: radius.pill,
    },
    tags: { position: 'absolute', top: space.s12, right: space.s12, flexDirection: 'row', gap: space.s4 },
    tag: { paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.glass },
    logo: {
      position: 'absolute',
      left: space.s12,
      bottom: space.s12,
      width: size.avatar.md,
      height: size.avatar.md,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    body: { gap: space.s4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    title: { flex: 1 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

export const VendorCard: React.FC<VendorCardProps> = ({ vendor: v, onPress, compact, pickup }) => {
  const styles = useStyles(makeStyles);
  const { colors, size, service } = useTheme();
  const closed = closedLabel(v);
  const { width: screen } = useWindowDimensions();
  const width = compact ? size.kitchenTile : screen;
  return (
    <Pressable
      onPress={onPress}
      style={compact ? styles.compact : styles.card}
      accessibilityRole="button"
      accessibilityLabel={[v.name, ratingLabel(v), cardLine(v, pickup), closed, v.dealLabel].filter(Boolean).join(', ')}
    >
      <View style={[styles.photo, compact && styles.railPhoto]}>
        {v.coverUrl ? <Image source={{ uri: cdn(v.coverUrl, { w: width }) ?? undefined }} style={styles.fill} contentFit="cover" transition={150} /> : null}
        {closed ? (
          <View style={styles.closed}>
            <AppText variant="bodyStrong" tone="onScrim" align="center" numberOfLines={2}>
              {closed}
            </AppText>
          </View>
        ) : null}
        {v.dealLabel ? (
          <View style={[styles.ribbon, { backgroundColor: service.accent }]}>
            <AppText variant="tag" tone="onAccent">
              {v.dealLabel}
            </AppText>
          </View>
        ) : null}
        {!compact && (v.isHomeKitchen || v.isNew) ? (
          <View style={styles.tags}>
            {v.isHomeKitchen ? (
              <View style={styles.tag}>
                <AppText variant="tag">Home kitchen</AppText>
              </View>
            ) : null}
            {v.isNew ? (
              <View style={styles.tag}>
                <AppText variant="tag">New</AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        {v.logoUrl ? (
          <View style={styles.logo}>
            <Image source={{ uri: cdn(v.logoUrl, { w: size.avatar.md }) ?? undefined }} style={styles.fill} contentFit="cover" />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant={compact ? 'bodyStrong' : 'title'} numberOfLines={1} style={styles.title}>
            {v.name}
          </AppText>
          <View style={styles.rating}>
            <IonIcon name="star" size="sm" color={colors.star} />
            <AppText variant="small">{ratingLabel(v)}</AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {cuisineLine(v)}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {cardLine(v, pickup)}
        </AppText>
        {/* Kitchen Intelligence's badges (the photo already says "Home kitchen"). */}
        {!compact ? <BadgeRow badges={(v.badges ?? []).filter(b => b !== 'home_kitchen').slice(0, 3)} /> : null}
      </View>
    </Pressable>
  );
};

export default VendorCard;
