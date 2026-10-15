// ═══════════════════════════════════════════════════════
// MetroMatrix — Food home parts (the customer's Food tab)
// ═══════════════════════════════════════════════════════
// Foodpanda is the competitor, so the Food tab reads like a delivery app a
// Pakistani customer already knows — sticky search, a promo carousel, a
// cuisine rail, "near you" tiles and full kitchen cards — in Food's pink,
// with more air, softer depth and calmer type than theirs. No photography
// exists yet, so each kitchen's art panel is its cuisine's glyph on a blush
// ground; an `imageUrl` from the API replaces it automatically.
// Presentational only: CustomerHomeScreen owns the state.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon, MciIcon, type MciName } from '../../Custom-Components/Icon';
import { Skeleton } from '../../Custom-Components/Skeleton';
import {
  KITCHEN_KIND_LABEL,
  formatDeliveryFee,
  formatEta,
  formatRatingCount,
  priceLevelLabel,
} from '../../models/foodModel';
import type { Cuisine, FoodPromo, Kitchen } from '../../types/food';

// ─── Cuisine glyphs ───────────────────────────────────
const CUISINE_GLYPH: Record<string, MciName> = {
  burgers: 'hamburger',
  pizza: 'pizza',
  'fried chicken': 'food-drumstick',
  'fried-chicken': 'food-drumstick',
  shawarma: 'food-takeout-box',
  bbq: 'grill',
  pakistani: 'pot-steam',
  'home food': 'home-heart',
  'desi-home': 'home-heart',
  desserts: 'cupcake',
  'fast food': 'hamburger',
  chinese: 'noodles',
  healthy: 'leaf',
};
export const cuisineGlyph = (key: string | undefined): MciName =>
  (key && CUISINE_GLYPH[key.trim().toLowerCase()]) || 'silverware-fork-knife';

const makeStyles = ({ colors, space, size, radius, gutter, elevation, type }: Theme) =>
  StyleSheet.create({
    // Search
    searchWrap: { paddingHorizontal: gutter, paddingVertical: space.s8, backgroundColor: colors.canvas },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      height: size.control.md,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
    },
    searchInput: { flex: 1, ...type.input, color: colors.ink, paddingVertical: space.s0, outlineWidth: 0, outlineStyle: 'solid' },
    // Sections
    section: { gap: space.s12 },
    sectionHead: { paddingHorizontal: gutter, gap: space.s4 },
    rail: { paddingHorizontal: gutter, gap: space.s12 },
    // Promos
    promo: {
      minHeight: size.promoCard,
      borderRadius: radius.lg,
      padding: space.s20,
      gap: space.s8,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    promoText: { gap: space.s4 },
    codeChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      marginTop: space.s4,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    // Cuisines
    cuisine: { alignItems: 'center', gap: space.s8, width: size.tile + space.s12 },
    cuisineTile: {
      width: size.tile,
      height: size.tile,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Kitchen card
    card: {
      marginHorizontal: gutter,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      borderWidth: size.hairline,
      borderColor: colors.line,
      ...elevation.raised,
    },
    art: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    artImage: { ...StyleSheet.absoluteFillObject },
    badges: { position: 'absolute', top: space.s12, left: space.s12, right: space.s12, flexDirection: 'row', gap: space.s8 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
    eta: {
      position: 'absolute',
      left: space.s12,
      bottom: space.s12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    cardBody: { padding: space.s16, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    // Tile
    tile: {
      width: size.kitchenTile,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      borderWidth: size.hairline,
      borderColor: colors.line,
    },
    tileBody: { padding: space.s12, gap: space.s4 },
    skeletonCard: { marginHorizontal: gutter, gap: space.s12 },
  });

// ─── Search ───────────────────────────────────────────
export const FoodSearchBar: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.searchWrap}>
      <View style={styles.search}>
        <IonIcon name="search" size="md" color={colors.inkMuted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search vendors, cuisines and dishes"
          placeholderTextColor={colors.inkFaint}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search the Food Court"
        />
        {value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <IonIcon name="close-circle" size="md" color={colors.inkFaint} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

// ─── Section header ───────────────────────────────────
export const FoodSection: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText variant="h2" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
};

// ─── Promotions ───────────────────────────────────────
export const PromoCarousel: React.FC<{ promos: FoodPromo[] }> = ({ promos }) => {
  const styles = useStyles(makeStyles);
  const { service, space, gutter } = useTheme();
  const { width } = useWindowDimensions();
  // One card and a peek of the next, like a delivery app's banner rail.
  const cardWidth = Math.min(width, 520) - gutter * 2 - space.s24;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      snapToInterval={cardWidth + space.s12}
      decelerationRate="fast">
      {promos.map((p, i) => {
        const bold = i % 2 === 0;
        const fg = bold ? service.onAccent : service.accentDeep;
        return (
          <View
            key={p.id}
            style={[styles.promo, { width: cardWidth, backgroundColor: bold ? service.accent : service.accentSoft }]}
            accessible
            accessibilityLabel={`${p.title}. ${p.subtitle}${p.code ? `. Use code ${p.code}` : ''}`}>
            <View style={styles.promoText}>
              <AppText variant="h2" style={{ color: fg }}>
                {p.title}
              </AppText>
              <AppText variant="small" style={{ color: fg }}>
                {p.subtitle}
              </AppText>
            </View>
            {p.code ? (
              <View style={styles.codeChip}>
                <MciIcon name="ticket-percent-outline" size="sm" color={service.accentDeep} />
                <AppText variant="small" tone="accentDeep">
                  Use code {p.code}
                </AppText>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
};

// ─── Cuisines ─────────────────────────────────────────
export const CuisineRail: React.FC<{ cuisines: Cuisine[]; selected: string | null; onToggle: (name: string) => void }> = ({
  cuisines,
  selected,
  onToggle,
}) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {cuisines.map(c => {
        const on = selected === c.name;
        return (
          <Pressable
            key={c.slug}
            onPress={() => onToggle(c.name)}
            style={styles.cuisine}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${c.name}${on ? ', selected' : ''}`}>
            <View style={[styles.cuisineTile, { backgroundColor: on ? service.accent : service.accentSoft }]}>
              <MciIcon name={cuisineGlyph(c.slug)} size="xl" color={on ? service.onAccent : service.accent} />
            </View>
            <AppText variant="small" tone={on ? 'accentDeep' : 'ink'} numberOfLines={1}>
              {c.name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// ─── Kitchen art (photo, or the cuisine glyph on blush) ─
const KitchenArt: React.FC<{ kitchen: Kitchen; height: number; children?: React.ReactNode }> = ({ kitchen, height, children }) => {
  const styles = useStyles(makeStyles);
  const { service, motion } = useTheme();
  const glyph = cuisineGlyph(kitchen.cuisines[0]);
  return (
    <View style={[styles.art, { height, backgroundColor: service.accentSoft }]}>
      {kitchen.imageUrl ? (
        <Image source={{ uri: kitchen.imageUrl }} style={styles.artImage} contentFit="cover" transition={motion.press.duration} />
      ) : (
        <MciIcon name={glyph} size="hero" color={service.accent} />
      )}
      {children}
    </View>
  );
};

const Rating: React.FC<{ kitchen: Kitchen }> = ({ kitchen }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.rating} accessible accessibilityLabel={`Rated ${kitchen.rating.toFixed(1)} from ${kitchen.ratingCount} reviews`}>
      <IonIcon name="star" size="sm" color={colors.star} />
      <AppText variant="bodyStrong">{kitchen.rating.toFixed(1)}</AppText>
      <AppText variant="caption" tone="muted">
        ({formatRatingCount(kitchen.ratingCount)})
      </AppText>
    </View>
  );
};

// ─── Full kitchen card (the list) ─────────────────────
export const KitchenCard: React.FC<{ kitchen: Kitchen; onPress: () => void }> = ({ kitchen, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size, opacity } = useTheme();
  const free = kitchen.deliveryFee <= 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${kitchen.name}, ${KITCHEN_KIND_LABEL[kitchen.kind]}, ${formatEta(kitchen)}, ${formatDeliveryFee(kitchen.deliveryFee)}${kitchen.deal ? `, ${kitchen.deal}` : ''}`}>
      <KitchenArt kitchen={kitchen} height={size.kitchenArt}>
        <View style={styles.badges}>
          {kitchen.deal ? (
            <View style={[styles.badge, { backgroundColor: service.accent }]}>
              <MciIcon name="tag" size="sm" color={service.onAccent} />
              <AppText variant="small" style={{ color: service.onAccent }}>
                {kitchen.deal}
              </AppText>
            </View>
          ) : null}
          <View style={styles.grow} />
          {kitchen.isNew ? (
            <View style={[styles.badge, { backgroundColor: colors.surface }]}>
              <AppText variant="small">New</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.eta}>
          <IonIcon name="time-outline" size="sm" color={colors.ink} />
          <AppText variant="small">{formatEta(kitchen)}</AppText>
        </View>
      </KitchenArt>
      <View style={styles.cardBody}>
        <View style={styles.row}>
          <AppText variant="title" style={styles.grow} numberOfLines={1}>
            {kitchen.name}
          </AppText>
          <Rating kitchen={kitchen} />
        </View>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {priceLevelLabel(kitchen.priceLevel)} · {kitchen.cuisines.join(', ')} · {KITCHEN_KIND_LABEL[kitchen.kind]}
        </AppText>
        <View style={styles.row}>
          <MciIcon name="moped-outline" size="sm" color={free ? service.accentDeep : colors.inkMuted} />
          <AppText variant="small" tone={free ? 'accentDeep' : 'muted'}>
            {formatDeliveryFee(kitchen.deliveryFee)}
          </AppText>
          <AppText variant="small" tone="muted">
            · Min Rs {kitchen.minOrder} · {kitchen.distanceKm.toFixed(1)} km
          </AppText>
        </View>
      </View>
    </Pressable>
  );
};

// ─── Compact tile (the "near you" rail) ───────────────
export const KitchenTile: React.FC<{ kitchen: Kitchen; onPress: () => void }> = ({ kitchen, onPress }) => {
  const styles = useStyles(makeStyles);
  const { size, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${kitchen.name}, ${formatEta(kitchen)}`}>
      <KitchenArt kitchen={kitchen} height={size.kitchenArtSmall} />
      <View style={styles.tileBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {kitchen.name}
        </AppText>
        <View style={styles.row}>
          <Rating kitchen={kitchen} />
          <AppText variant="caption" tone="muted">
            · {formatEta(kitchen)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
};

// ─── Loading ──────────────────────────────────────────
export const FoodHomeSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.section} accessibilityLabel="Loading kitchens" accessibilityRole="progressbar">
      <View style={styles.skeletonCard}>
        <Skeleton height={size.promoCard} shape="lg" />
      </View>
      <View style={styles.rail}>
        <View style={styles.row}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width={size.tile} height={size.tile} shape="pill" />
          ))}
        </View>
      </View>
      {Array.from({ length: 2 }, (_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={size.kitchenArt} shape="lg" />
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </View>
      ))}
    </View>
  );
};
