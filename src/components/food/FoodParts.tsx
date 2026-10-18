// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court parts (the customer's Food app)
// ═══════════════════════════════════════════════════════
// The pieces a delivery app customer already knows — the search pill, a
// cuisine rail, vendor rails with "See all", section heads and the loading
// shape — in Food's pink, on white, with calm type. Presentational only.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MAX_FONT_SCALE, useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon, MciIcon, type MciName } from '../../Custom-Components/Icon';
import { Skeleton } from '../../Custom-Components/Skeleton';
import { TextAction } from '../../Custom-Components/TextAction';
import { VendorCard } from '../../Custom-Components/food/VendorCard';
import { useOnGradient } from '../../Custom-Components/headerInk';
import type { FoodCuisine, VendorCard as VendorCardData } from '../../types/food';

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
    // Inside the gradient header: the header gives the gutter; the pill is white.
    searchWrapOnGradient: { paddingHorizontal: space.s0, paddingVertical: space.s0, backgroundColor: 'transparent' },
    searchOnGradient: { backgroundColor: colors.surface },
    section: { gap: space.s12 },
    sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.s12, paddingHorizontal: gutter },
    sectionText: { flex: 1, gap: space.s4 },
    rail: { paddingHorizontal: gutter, gap: space.s16 },
    cuisineRail: { paddingHorizontal: gutter, gap: space.s12 },
    cuisine: { alignItems: 'center', gap: space.s8, width: size.tile + space.s12 },
    cuisineTile: { width: size.tile, height: size.tile, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', gap: space.s12 },
    skeletonCard: { marginHorizontal: gutter, gap: space.s12 },
  });

// ─── Search ───────────────────────────────────────────
/** The home's search pill: a button that opens Search. */
export const FoodSearchButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const onGradient = useOnGradient();
  return (
    <View style={[styles.searchWrap, onGradient && styles.searchWrapOnGradient]}>
      <Pressable onPress={onPress} style={[styles.search, onGradient && styles.searchOnGradient]} accessibilityRole="search" accessibilityLabel="Search dishes and restaurants">
        <IonIcon name="search" size="md" color={colors.inkMuted} />
        <AppText variant="body" tone="faint">
          Search dishes and restaurants
        </AppText>
      </Pressable>
    </View>
  );
};

/** Search's own field. */
export const FoodSearchField: React.FC<{ value: string; onChange: (v: string) => void; onSubmit: () => void; autoFocus?: boolean }> = ({ value, onChange, onSubmit, autoFocus }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const onGradient = useOnGradient();
  return (
    <View style={[styles.searchWrap, onGradient && styles.searchWrapOnGradient]}>
      <View style={[styles.search, onGradient && styles.searchOnGradient]}>
        <IonIcon name="search" size="md" color={colors.inkMuted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          placeholder="Biryani, burgers, a restaurant…"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          placeholderTextColor={colors.inkFaint}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search dishes and restaurants"
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

// ─── Sections ─────────────────────────────────────────
export const FoodSection: React.FC<{ title: string; subtitle?: string; onSeeAll?: () => void; children: React.ReactNode }> = ({ title, subtitle, onSeeAll, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionText}>
          <AppText variant="sectionTitle" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {onSeeAll ? <TextAction label="See all" onPress={onSeeAll} /> : null}
      </View>
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
            accessibilityState={{ selected: on }}
            accessibilityLabel={c.name}
          >
            <View style={[styles.cuisineTile, { backgroundColor: on ? service.accent : service.accentSoft }]}>
              <MciIcon name={cuisineGlyph(c.icon || c.slug)} size="xl" color={on ? service.onAccent : service.accent} />
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

// ─── Loading ──────────────────────────────────────────
export const FoodHomeSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.section} accessibilityLabel="Loading restaurants" accessibilityRole="progressbar">
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
