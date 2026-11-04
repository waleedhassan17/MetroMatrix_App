// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court parts (the customer's Food app)
// ═══════════════════════════════════════════════════════
// The pieces a delivery app customer already knows — a cuisine rail, vendor
// and dish rails under the ONE section head (Shopping's ShopSection), deal
// tags, the live-order card, the trust line and the loading shape — in
// Food's pink, on white, with calm type. Presentational only. Search is
// Shopping's SearchPill / SearchField.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon, MciIcon, type IonName, type MciName } from '../../Custom-Components/Icon';
import { Skeleton } from '../../Custom-Components/Skeleton';
import { VendorCard } from '../../Custom-Components/food/VendorCard';
import { SurplusCard } from '../../Custom-Components/kitchen/SurplusCard';
import { ShopSection } from '../shopping/ShopParts';
import { RowCard } from '../admin/AdminParts';
import { cdn } from '../../utils/cdn/cdn';
import { formatPKR } from '../../utils/money/money';
import { ORDER_STATUS, orderStatusLabel } from '../../models/food/foodStatusModel';
import type { FoodCuisine, FoodOrderSummary, VendorCard as VendorCardData } from '../../models/food';
import type { SurplusCard as SurplusCardData } from '../../models/kitchen';

// ─── Cuisine glyphs (the Food API's icon keys, and slugs) ─
const CUISINE_GLYPH: Record<string, MciName> = {
  pakistani: 'pot-steam',
  bbq: 'grill',
  fast_food: 'hamburger',
  'fast-food': 'hamburger',
  burger: 'hamburger',
  burgers: 'hamburger',
  pizza: 'pizza',
  chinese: 'noodles',
  biryani: 'rice',
  karahi: 'pot-steam',
  dessert: 'cupcake',
  desserts: 'cupcake',
  bakery: 'baguette',
  cafe: 'coffee',
  healthy: 'leaf',
  breakfast: 'egg-fried',
  shawarma: 'food-takeout-box',
  roll: 'food-takeout-box',
  rolls: 'food-takeout-box',
  ice_cream: 'ice-cream',
  'ice-cream': 'ice-cream',
  home_food: 'home-heart',
  'home-food': 'home-heart',
  beverage: 'cup',
  beverages: 'cup',
  seafood: 'fish',
};

/** The icon keys staff can give a cuisine (each has its own glyph). */
export const CUISINE_ICON_KEYS = ['pakistani', 'bbq', 'burger', 'pizza', 'chinese', 'biryani', 'dessert', 'bakery', 'cafe', 'healthy', 'breakfast', 'shawarma', 'ice_cream', 'home_food', 'beverage', 'seafood'];

export const cuisineGlyph = (key: string | undefined): MciName => (key && CUISINE_GLYPH[key.trim().toLowerCase()]) || 'silverware-fork-knife';

const makeStyles = ({ colors, space, size, radius, gutter, type }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12 },
    rail: { paddingHorizontal: gutter, gap: space.s16 },
    cuisineRail: { paddingHorizontal: gutter, gap: space.s12 },
    cuisine: { alignItems: 'center', gap: space.s8, width: size.tile + space.s12 },
    cuisineTile: { width: size.tile, height: size.tile, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    // Room for two lines, so a long name wraps (at large text too) instead of cutting.
    cuisineLabel: { minHeight: (type.small.lineHeight ?? 18) * 2 },
    row: { flexDirection: 'row', gap: space.s12 },
    skeletonCard: { marginHorizontal: gutter, gap: space.s12 },
    trust: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    trustText: { flex: 1 },
    dealRail: { paddingHorizontal: gutter, gap: space.s8 },
    deal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
    },
    dish: { width: size.railCard, gap: space.s4 },
    dishPhoto: {
      width: size.railCard,
      height: size.railCard,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fill: { ...StyleSheet.absoluteFillObject },
    dishTag: {
      position: 'absolute',
      top: space.s8,
      left: space.s8,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.glass,
    },
    dishName: { minHeight: (type.small.lineHeight ?? 18) * 2 },
  });

// ─── Sections ─────────────────────────────────────────
/** A titled rail: Shopping's ONE section head ("View all" pill) over its content. */
export const FoodSection: React.FC<{ title: string; subtitle?: string; onSeeAll?: () => void; children: React.ReactNode }> = ({ title, subtitle, onSeeAll, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <ShopSection title={title} subtitle={subtitle} onSeeAll={onSeeAll} />
      {children}
    </View>
  );
};

// ─── Cuisines ─────────────────────────────────────────
export const CuisineRail: React.FC<{ cuisines: FoodCuisine[]; selected?: string | null; onPress: (c: FoodCuisine) => void }> = ({ cuisines, selected, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuisineRail}>
      {cuisines.map(c => {
        const on = selected === c.slug;
        return (
          <Pressable
            key={c.id}
            onPress={() => onPress(c)}
            style={styles.cuisine}
            accessibilityRole="button"
            aria-selected={on}
            accessibilityLabel={c.name}
          >
            <View style={[styles.cuisineTile, { backgroundColor: on ? service.accent : service.accentSoft }]}>
              <MciIcon name={cuisineGlyph(c.icon || c.slug)} size="xl" color={on ? service.onAccent : service.accent} />
            </View>
            {/* Two lines kept for every label, so large text wraps instead of cutting the name. */}
            <AppText variant="small" tone={on ? 'accentDeep' : 'ink'} numberOfLines={2} align="center" style={styles.cuisineLabel}>
              {c.name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// ─── Vendor rails ─────────────────────────────────────
export const VendorRail: React.FC<{ vendors: VendorCardData[]; onOpen: (v: VendorCardData) => void }> = ({ vendors, onOpen }) => {
  const styles = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {vendors.map(v => (
        <VendorCard key={v.id} vendor={v} compact onPress={() => onOpen(v)} />
      ))}
    </ScrollView>
  );
};

/** Bachat Boxes near the customer, side by side (Kitchen Intelligence). */
export const SurplusRail: React.FC<{ boxes: SurplusCardData[]; onOpen: (b: SurplusCardData) => void }> = ({ boxes, onOpen }) => {
  const styles = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {boxes.map(b => (
        <SurplusCard key={b.id} card={b} rail onPress={() => onOpen(b)} />
      ))}
    </ScrollView>
  );
};

// ─── Dishes ───────────────────────────────────────────
export interface DishTileData {
  id: string;
  name: string;
  photoUrl: string | null;
  fromPrice: number;
  hasVariants: boolean;
  /** "Signature" — the kitchen's own recipe. */
  tag?: string | null;
}

/** A dish in a rail: its square photo, the name on two lines, the price. */
export const DishTile: React.FC<{ dish: DishTileData; onPress: () => void; icon?: IonName }> = ({ dish: d, onPress, icon = 'restaurant-outline' }) => {
  const styles = useStyles(makeStyles);
  const { colors, size, motion } = useTheme();
  const price = d.hasVariants ? `from ${formatPKR(d.fromPrice)}` : formatPKR(d.fromPrice);
  return (
    <Pressable onPress={onPress} style={styles.dish} accessibilityRole="button" accessibilityLabel={[d.tag, d.name, price].filter(Boolean).join(', ')}>
      <View style={styles.dishPhoto}>
        {d.photoUrl ? (
          <Image source={{ uri: cdn(d.photoUrl, { w: size.railCard, h: size.railCard }) ?? undefined }} style={styles.fill} contentFit="cover" transition={motion.imageFade} />
        ) : (
          <IonIcon name={icon} size="lg" color={colors.inkFaint} />
        )}
        {d.tag ? (
          <View style={styles.dishTag}>
            <AppText variant="tag">{d.tag}</AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="small" numberOfLines={2} style={styles.dishName}>
        {d.name}
      </AppText>
      <AppText variant="bodyStrong" tone="accentDeep">
        {price}
      </AppText>
    </Pressable>
  );
};

export const DishRail: React.FC<{ dishes: DishTileData[]; onOpen: (id: string) => void }> = ({ dishes, onOpen }) => {
  const styles = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {dishes.map(d => (
        <DishTile key={d.id} dish={d} onPress={() => onOpen(d.id)} />
      ))}
    </ScrollView>
  );
};

// ─── Deals ────────────────────────────────────────────
/** A deal the kitchen runs, said as a tag: it applies by itself at checkout, so it is not a button. */
export const DealTag: React.FC<{ label: string }> = ({ label }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View style={[styles.deal, { backgroundColor: service.accentSoft, borderColor: service.accentLine }]} accessibilityLabel={`Deal: ${label}`}>
      <IonIcon name="pricetag-outline" size="sm" color={service.accentDeep} />
      <AppText variant="chip" tone="accentDeep" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
};

export const DealRail: React.FC<{ deals: { id: string; label: string }[] }> = ({ deals }) => {
  const styles = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealRail}>
      {deals.map(d => (
        <DealTag key={d.id} label={d.label} />
      ))}
    </ScrollView>
  );
};

// ─── Trust ────────────────────────────────────────────
/** The trust line (models/food/trustModel), once per page: who is paid, who delivers, no commission. */
export const TrustNote: React.FC<{ text: string }> = ({ text }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.trust}>
      <IonIcon name="shield-checkmark-outline" size="sm" color={colors.inkMuted} />
      <AppText variant="caption" tone="muted" style={styles.trustText}>
        {text}
      </AppText>
    </View>
  );
};

// ─── Orders ───────────────────────────────────────────
/** A kitchen's round mark (its logo, or its initials on Food pink). */
export const kitchenMark = (v: { name: string; logoUrl: string | null; brandColor?: string | null }, fallback: string) => ({
  store: { name: v.name, logoUrl: v.logoUrl, brandColor: v.brandColor || fallback },
});

/** One Food order as a raised row: the kitchen's mark, ONE pill, the total and a chevron. */
export const FoodOrderRow: React.FC<{ order: FoodOrderSummary; onPress: () => void; when: string }> = ({ order: o, onPress, when }) => {
  const { service } = useTheme();
  const label = orderStatusLabel(o.status, o.fulfilment);
  const items = `${o.itemCount} ${o.itemCount === 1 ? 'item' : 'items'}${o.fulfilment === 'pickup' ? ' · Pick-up' : ''}`;
  return (
    <RowCard
      title={o.vendor.name}
      lines={[`${o.code} · ${when}`]}
      mark={kitchenMark(o.vendor, service.accent)}
      pill={{ label, tone: ORDER_STATUS[o.status].tone }}
      foot={{ left: items, right: formatPKR(o.total) }}
      chevron
      onPress={onPress}
      accessibilityLabel={`Order ${o.code} from ${o.vendor.name}, ${label}, ${items}, ${formatPKR(o.total)}`}
    />
  );
};

/** The Food home's live order: one order opens it; two or more open the Orders tab. */
export const ActiveOrderCard: React.FC<{ orders: FoodOrderSummary[]; onOpen: (code: string) => void; onAll: () => void }> = ({ orders, onOpen, onAll }) => {
  const { service } = useTheme();
  const first = orders[0];
  if (!first) return null;
  if (orders.length > 1) {
    return (
      <RowCard
        title={`${orders.length} orders in progress`}
        lines={[orders.map(o => o.vendor.name).join(' · ')]}
        mark={{ icon: 'receipt-outline', tint: 'accent' }}
        chevron
        onPress={onAll}
      />
    );
  }
  const label = orderStatusLabel(first.status, first.fulfilment);
  return (
    <RowCard
      title={`Your order from ${first.vendor.name}`}
      lines={[`${first.code} · ${first.itemCount} ${first.itemCount === 1 ? 'item' : 'items'} · ${formatPKR(first.total)}`]}
      mark={kitchenMark(first.vendor, service.accent)}
      pill={{ label, tone: ORDER_STATUS[first.status].tone }}
      chevron
      onPress={() => onOpen(first.code)}
      accessibilityLabel={`Your order from ${first.vendor.name}, ${label}. Track it`}
    />
  );
};

// ─── Loading ──────────────────────────────────────────
export const FoodHomeSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.section} accessibilityLabel="Loading kitchens" accessibilityRole="progressbar">
      <View style={styles.cuisineRail}>
        <View style={styles.row}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width={size.tile} height={size.tile} shape="pill" />
          ))}
        </View>
      </View>
      {Array.from({ length: 2 }, (_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={size.kitchenTile / size.railPhotoAspect} shape="lg" />
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </View>
      ))}
    </View>
  );
};
