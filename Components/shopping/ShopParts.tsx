// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping screen parts (customer)
// ═══════════════════════════════════════════════════════
// The pieces every Shopping screen shares: the top bar with the Bag, a
// section header, the search pill, the home's banner carousel, and the
// two-column product grid the server pages.

import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_FONT_SCALE, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  CountIconButton,
  EmptyState,
  IconButton,
  InlineNotice,
  IonIcon,
  PageHeader,
  PhotoBannerCarousel,
  ProductCard,
  ProductCardSkeleton,
  type EmptyStateProps,
} from '../../Custom-Components/index';
import { useOnGradient } from '../../Custom-Components/headerInk';
import { useBagCount, useSaved, useShopNav } from '../../hooks/useShop';
import { useCalmMotion } from '../../hooks/useCalmMotion';
import type { PagedList } from '../../hooks/usePagedList';
import type { Banner, ProductSummary } from '../../models';

const makeStyles = ({ colors, space, size, radius, gutter, type, elevation }: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.headerBar,
      paddingHorizontal: space.s8,
      backgroundColor: colors.canvas,
    },
    barRuled: { borderBottomWidth: size.focusBorder },
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
      // The FYP search box: white, a line, a soft shadow.
      backgroundColor: colors.surface,
      ...elevation.card,
      borderColor: colors.line,
    },
    pillOnGradient: { marginHorizontal: space.s0, backgroundColor: colors.surface, borderColor: colors.surface },
    pillText: { ...type.input, color: colors.inkFaint, flex: 1 },
    pillHint: { flex: 1 },
    pillInput: { ...type.input, color: colors.ink, flex: 1, paddingVertical: space.s0, outlineWidth: 0, outlineStyle: 'solid' },
    // Two columns with the page gutter outside and space.s12 between them:
    // each cell carries gutter on its outer side and half the gap inside.
    cellLeft: { flex: 1, paddingLeft: gutter, paddingRight: space.s12 / 2, paddingBottom: space.s24 },
    cellRight: { flex: 1, paddingLeft: space.s12 / 2, paddingRight: gutter, paddingBottom: space.s24 },
    skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    skeletonCell: { width: '50%' },
    footer: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s12 },
  });

// ─── Top bar ──────────────────────────────────────────
// The Shopping module's page header: the FYP's orange gradient PageHeader
// (search, the Bag and other actions in white). Inside a store the theme
// asks for a white bar instead, with the store's colour as a rule under it
// (the FYP's BrandHeader).
export const ShopTopBar: React.FC<{
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Extra buttons before the Bag. */
  right?: React.ReactNode;
  showBag?: boolean;
  /** Gradient header only: content inside it, under the title (a search field). */
  children?: React.ReactNode;
}> = ({ title, subtitle, onBack, right, showBag = true, children }) => {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { header, service } = useTheme();
  const count = useBagCount();
  const { openBag } = useShopNav();
  const actions = (
    <>
      {right}
      {showBag ? <CountIconButton icon="bag-handle-outline" count={count} onPress={openBag} label="Bag" /> : null}
    </>
  );
  if (header.tone === 'gradient') {
    return (
      <PageHeader title={title} subtitle={subtitle} onBack={onBack} right={actions}>
        {children}
      </PageHeader>
    );
  }
  return (
    <View style={[styles.bar, styles.barRuled, { paddingTop: insets.top, borderBottomColor: service.accent }]}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} accessibilityLabel="Back" /> : null}
      <View style={styles.barTitle}>
        {title ? (
          <AppText variant="barTitle" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.barSide}>{actions}</View>
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
        <AppText variant="sectionTitle" accessibilityRole="header">
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
/**
 * `hints` rotate in the pill ("Search doctors", "Search specialties" …),
 * fading between each other; they hold on the first under reduced motion.
 * A screen reader always hears `label`.
 */
export const SearchPill: React.FC<{ label: string; onPress: () => void; style?: ViewStyle; hints?: string[] }> = ({ label, onPress, style, hints }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const onGradient = useOnGradient();
  const { hint, fade } = useRotatingHint(hints);
  return (
    <Pressable onPress={onPress} accessibilityRole="search" accessibilityLabel={label} style={[styles.pill, onGradient && styles.pillOnGradient, style]}>
      <IonIcon name="search" size="md" color={colors.inkMuted} />
      <Animated.View style={[styles.pillHint, { opacity: fade }]}>
        <AppText style={styles.pillText} numberOfLines={1}>
          {hint ?? label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
};

const useRotatingHint = (hints: string[] | undefined) => {
  const { motion } = useTheme();
  const calm = useCalmMotion();
  const [index, setIndex] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const count = hints?.length ?? 0;
  useEffect(() => {
    if (count < 2 || calm) return;
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: motion.hintFade, useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % count);
        Animated.timing(fade, { toValue: 1, duration: motion.hintFade, useNativeDriver: true }).start();
      });
    }, motion.hintInterval);
    return () => {
      clearInterval(t);
      fade.setValue(1);
    };
  }, [count, calm, fade, motion.hintFade, motion.hintInterval]);
  return { hint: count ? hints![calm ? 0 : index % count] : null, fade };
};

// ─── Search field (filters in place) ──────────────────
export const SearchField: React.FC<{
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  style?: ViewStyle;
  autoFocus?: boolean;
  onSubmit?: () => void;
}> = ({ value, onChange, placeholder, style, autoFocus, onSubmit }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const onGradient = useOnGradient();
  return (
    <View style={[styles.pill, onGradient && styles.pillOnGradient, style]}>
      <IonIcon name="search" size="md" color={colors.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        style={styles.pillInput}
        returnKeyType="search"
        autoCorrect={false}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
          <IonIcon name="close-circle" size="md" color={colors.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  );
};

// ─── Banner carousel ──────────────────────────────────
/** The shop's promotions (the shared PhotoBannerCarousel). */
export const BannerCarousel: React.FC<{ banners: Banner[]; onOpen: (b: Banner) => void }> = ({ banners, onOpen }) => (
  <PhotoBannerCarousel banners={banners} onOpen={onOpen} />
);

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

