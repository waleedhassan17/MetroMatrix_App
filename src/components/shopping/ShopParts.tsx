// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping screen parts (customer)
// ═══════════════════════════════════════════════════════
// The pieces every Shopping screen shares: the top bar with the Bag, a
// section header, the search pill, the home's banner carousel, and the
// two-column product grid the server pages.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  CountIconButton,
  EmptyState,
  IconButton,
  InlineNotice,
  IonIcon,
  PhotoScrim,
  ProductCard,
  ProductCardSkeleton,
  type EmptyStateProps,
} from '@custom/index';
import { useBagCount, useSaved, useShopNav } from '@hooks/useShop';
import type { PagedList } from '@hooks/usePagedList';
import type { Banner, ProductSummary } from '@/types';
import { cdn } from '@utils/cdn';

const makeStyles = ({ colors, space, size, radius, gutter, type }: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.headerBar,
      paddingHorizontal: space.s8,
      backgroundColor: colors.canvas,
    },
    barTitle: { flex: 1, paddingHorizontal: space.s4 },
    barSide: { flexDirection: 'row', alignItems: 'center' },
    section: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: gutter, gap: space.s12 },
    sectionText: { flex: 1, gap: space.s4 },
    seeAll: { minHeight: size.touch, justifyContent: 'center' },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      height: size.control.md,
      marginHorizontal: gutter,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
    },
    pillText: { ...type.input, color: colors.inkFaint, flex: 1 },
    banner: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    bannerText: { position: 'absolute', left: space.s20, right: space.s20, bottom: space.s20, gap: space.s4 },
    bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: space.s4, paddingTop: space.s8 },
    dot: { width: size.pageDot, height: size.pageDot, borderRadius: radius.pill, backgroundColor: colors.line },
    // Two columns with the page gutter outside and space.s12 between them:
    // each cell carries gutter on its outer side and half the gap inside.
    cellLeft: { flex: 1, paddingLeft: gutter, paddingRight: space.s12 / 2, paddingBottom: space.s24 },
    cellRight: { flex: 1, paddingLeft: space.s12 / 2, paddingRight: gutter, paddingBottom: space.s24 },
    skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    skeletonCell: { width: '50%' },
    footer: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s12 },
  });

// ─── Top bar ──────────────────────────────────────────
export const ShopTopBar: React.FC<{
  title?: string;
  onBack?: () => void;
  /** Extra buttons before the Bag. */
  right?: React.ReactNode;
  showBag?: boolean;
}> = ({ title, onBack, right, showBag = true }) => {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const count = useBagCount();
  const { openBag } = useShopNav();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} accessibilityLabel="Back" /> : null}
      <View style={styles.barTitle}>
        {title ? (
          <AppText variant="barTitle" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
      </View>
      <View style={styles.barSide}>
        {right}
        {showBag ? <CountIconButton icon="bag-handle-outline" count={count} onPress={openBag} label="Bag" /> : null}
      </View>
    </View>
  );
};

// ─── Section header ───────────────────────────────────
export const ShopSection: React.FC<{ title: string; subtitle?: string; onSeeAll?: () => void; seeAllLabel?: string }> = ({
  title,
  subtitle,
  onSeeAll,
  seeAllLabel = 'See all',
}) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionText}>
        <AppText variant="h2" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} accessibilityRole="link" accessibilityLabel={`${seeAllLabel}: ${title}`} style={styles.seeAll} hitSlop={8}>
          <AppText variant="small" tone="accentDeep">
            {seeAllLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
};

// ─── Search pill (opens the search screen) ────────────
export const SearchPill: React.FC<{ label: string; onPress: () => void; style?: ViewStyle }> = ({ label, onPress, style }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="search" accessibilityLabel={label} style={[styles.pill, style]}>
      <IonIcon name="search" size="md" color={colors.inkMuted} />
      <AppText style={styles.pillText} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
};

// ─── Banner carousel ──────────────────────────────────
/** Advances every 6 s; a touch pauses it until the finger lifts. */
export const BannerCarousel: React.FC<{ banners: Banner[]; onOpen: (b: Banner) => void }> = ({ banners, onOpen }) => {
  const styles = useStyles(makeStyles);
  const { gutter, space, size, motion, colors } = useTheme();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const cardWidth = Math.min(width, 640) - gutter * 2;
  const pitch = cardWidth + space.s12;

  useEffect(() => {
    if (held || banners.length < 2) return;
    const t = setInterval(() => {
      setIndex(i => {
        const next = (i + 1) % banners.length;
        ref.current?.scrollTo({ x: next * pitch, animated: true });
        return next;
      });
    }, motion.bannerInterval);
    return () => clearInterval(t);
  }, [held, banners.length, pitch, motion.bannerInterval]);

  if (!banners.length) return null;
  return (
    <View>
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
        {banners.map(b => (
          <Pressable
            key={b.id}
            onPress={() => onOpen(b)}
            accessibilityRole="button"
            accessibilityLabel={`${b.headline}${b.subhead ? `. ${b.subhead}` : ''}`}
            style={[styles.banner, { width: cardWidth, aspectRatio: size.bannerAspect }]}>
            <Image
              source={{ uri: cdn(b.imageUrl, { w: cardWidth, h: cardWidth / size.bannerAspect }) ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={motion.imageFade}
            />
            <PhotoScrim />
            <View style={styles.bannerText}>
              <AppText variant="h2" tone="onScrim">
                {b.headline}
              </AppText>
              {b.subhead ? (
                <AppText variant="small" style={{ color: colors.onScrimSoft }}>
                  {b.subhead}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View style={styles.bannerDots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && { backgroundColor: colors.ink, width: size.pageDotActive }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

// ─── Product grid (server-paged) ──────────────────────
export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.skeletonGrid} accessibilityLabel="Loading products" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.skeletonCell, i % 2 === 0 ? styles.cellLeft : styles.cellRight]}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
};

export interface ProductGridProps {
  list: PagedList<ProductSummary>;
  header?: React.ReactElement;
  empty: EmptyStateProps;
  showStore?: boolean;
  onRemoveFromSaved?: (productId: string) => void;
}

/**
 * Two columns, loaded a page at a time as you scroll (FlashList). The header
 * scrolls with the grid; while the first page loads, skeleton cards stand in.
 */
export const ProductGrid: React.FC<ProductGridProps> = ({ list, header, empty, showStore = true, onRemoveFromSaved }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { openProduct } = useShopNav();
  const saved = useSaved();

  const footer = list.isLoading && !list.rows.length ? (
    <ProductGridSkeleton />
  ) : list.error && !list.rows.length ? (
    <View style={styles.footer}>
      <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
    </View>
  ) : !list.rows.length ? (
    <View style={styles.footer}>
      <EmptyState {...empty} />
    </View>
  ) : list.isLoadingMore ? (
    <ProductGridSkeleton count={2} />
  ) : (
    <View style={styles.footer} />
  );

  return (
    <FlashList
      data={list.rows}
      numColumns={2}
      keyExtractor={p => p.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.6}
      refreshing={list.isRefreshing}
      onRefresh={list.refresh}
      style={{ backgroundColor: colors.canvas }}
      renderItem={({ item, index }) => (
        <View style={index % 2 === 0 ? styles.cellLeft : styles.cellRight}>
          <ProductCard
            product={item}
            showStore={showStore}
            onPress={() => openProduct(item.id, item.name)}
            saved={saved.isSaved(item.id)}
            onToggleSave={() => {
              const wasSaved = saved.isSaved(item.id);
              void saved.toggle(item.id);
              if (wasSaved) onRemoveFromSaved?.(item.id);
            }}
          />
        </View>
      )}
    />
  );
};

/** A full-width retry row for a section that failed. */
export const SectionError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.footer}>
      <InlineNotice message={message} action={{ label: 'Try again', onPress: onRetry }} />
    </View>
  );
};

