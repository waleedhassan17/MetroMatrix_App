// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping screen parts (customer)
// ═══════════════════════════════════════════════════════
// The pieces every Shopping screen shares: the top bar with the Bag, the
// floating buttons over a photo top, a section header, the search pill, the
// home's banner carousel, a page's policy strip, and the two-column product
// grid the server pages.

import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_FONT_SCALE, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Card,
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
import { useBarStyle } from '../../hooks/useBarStyle';
import type { PolicyLine } from '../../models/shopping/storePolicyModel';
import { useHeaderFieldStyle, useOnGradient } from '../../Custom-Components/headerInk';
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
    section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    sectionInset: { paddingHorizontal: gutter },
    sectionText: { flex: 1, gap: space.s4 },
    // "View all": the FYP's soft accent pill.
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
    },
    photoTop: {
      position: 'absolute',
      left: space.s0,
      right: space.s0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
    },
    photoTopEnd: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    policy: { flexDirection: 'row', alignItems: 'flex-start' },
    policyItem: { flex: 1, alignItems: 'center', gap: space.s4, paddingHorizontal: space.s4 },
    policyRule: { width: size.hairline, alignSelf: 'stretch', backgroundColor: colors.line },
    pill: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    // On a white page: the FYP search box, white with a line and a soft shadow.
    pillOnPage: {
      height: size.control.md,
      marginHorizontal: gutter,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      ...elevation.card,
      borderColor: colors.line,
    },
    pillText: { ...type.body, color: colors.inkFaint, flex: 1 },
    pillHint: { flex: 1 },
    pillInput: { ...type.body, color: colors.ink, flex: 1, paddingVertical: space.s0, outlineWidth: 0, outlineStyle: 'solid' },
    // Two columns with the page gutter outside and space.s12 between them:
    // each cell carries gutter on its outer side and half the gap inside.
    cellLeft: { flex: 1, paddingLeft: gutter, paddingRight: space.s12 / 2, paddingBottom: space.s12 },
    cellRight: { flex: 1, paddingLeft: space.s12 / 2, paddingRight: gutter, paddingBottom: space.s12 },
    topPad: { height: space.s20 },
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
/**
 * The ONE section head on Shopping pages (sectionTitle, 19 / 800), with a
 * muted line under it and "View all" as the FYP's soft accent pill. `inset`
 * adds the gutter (a full-bleed page); inside a padded ScreenShell pass false.
 */
export const ShopSection: React.FC<{
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  inset?: boolean;
  /** Anything else at the head's end (a count, "Clear all"). */
  trailing?: React.ReactNode;
}> = ({ title, subtitle, onSeeAll, seeAllLabel = 'View all', inset = true, trailing }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <View style={[styles.section, inset && styles.sectionInset]}>
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
      {trailing ?? null}
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="link"
          accessibilityLabel={`${seeAllLabel}: ${title}`}
          hitSlop={10}
          style={({ pressed }) => [styles.seeAll, { backgroundColor: service.accentSoft }, pressed && { opacity: opacity.pressed }]}>
          <AppText variant="chip" tone="accentDeep">
            {seeAllLabel}
          </AppText>
          <IonIcon name="chevron-forward" size="sm" color={service.accentDeep} />
        </Pressable>
      ) : null}
    </View>
  );
};

// ─── Photo top bar ────────────────────────────────────
/**
 * The FYP's floating buttons over a page that opens on a photo (a product,
 * a store's cover): back on the left, white circles on the right, under the
 * status bar. The page lays a top fade (PhotoScrim edge="top") under them.
 */
export const PhotoTopBar: React.FC<{
  onBack?: () => void;
  /** More circles before the Bag (share, the heart, search). */
  right?: React.ReactNode;
  showBag?: boolean;
  /** Another service's bag (Food Court's) in place of Shopping's. */
  bag?: { count: number; onPress: () => void };
}> = ({ onBack, right, showBag = true, bag }) => {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { space } = useTheme();
  const shopCount = useBagCount();
  const { openBag } = useShopNav();
  useBarStyle(true);
  return (
    <View style={[styles.photoTop, { top: insets.top + space.s8 }]} pointerEvents="box-none">
      {onBack ? <IconButton icon="chevron-back" appearance="circle" onPress={onBack} accessibilityLabel="Back" /> : <View />}
      <View style={styles.photoTopEnd}>
        {right}
        {showBag ? (
          <CountIconButton icon="bag-handle-outline" appearance="circle" count={bag ? bag.count : shopCount} onPress={bag ? bag.onPress : openBag} label="Bag" />
        ) : null}
      </View>
    </View>
  );
};

// ─── Policy strip ─────────────────────────────────────
/** When it ships, what delivery costs, returns: three columns in one card. */
export const PolicyStrip: React.FC<{ lines: PolicyLine[] }> = ({ lines }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <Card>
      <View style={styles.policy} accessible accessibilityLabel={lines.map(l => l.text).join('. ')}>
        {lines.map((l, i) => (
          <React.Fragment key={l.text}>
            {i > 0 ? <View style={styles.policyRule} /> : null}
            <View style={styles.policyItem}>
              <IonIcon name={l.icon} size="md" color={service.accentDeep} />
              <AppText variant="caption" align="center" numberOfLines={2}>
                {l.text}
              </AppText>
            </View>
          </React.Fragment>
        ))}
      </View>
    </Card>
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
  const field = useHeaderFieldStyle();
  const { hint, fade } = useRotatingHint(hints);
  return (
    <Pressable onPress={onPress} accessibilityRole="search" accessibilityLabel={label} style={[styles.pill, onGradient ? field : styles.pillOnPage, style]}>
      <IonIcon name="search" size={onGradient ? 'field' : 'md'} color={onGradient ? colors.inkFaint : colors.inkMuted} />
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
  const field = useHeaderFieldStyle();
  return (
    <View style={[styles.pill, onGradient ? field : styles.pillOnPage, style]}>
      <IonIcon name="search" size={onGradient ? 'field' : 'md'} color={onGradient ? colors.inkFaint : colors.inkMuted} />
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
  /** 20 above the first row when no header sits there (under the page header). */
  topPad?: boolean;
  /** The grid's scroll position (a photo-top page swaps its floating bar for the white one). */
  onScrollY?: (y: number) => void;
  empty: EmptyStateProps;
  showStore?: boolean;
  onRemoveFromSaved?: (productId: string) => void;
}

/**
 * Two columns, loaded a page at a time as you scroll (FlashList). The header
 * scrolls with the grid; while the first page loads, skeleton cards stand in.
 */
export const ProductGrid: React.FC<ProductGridProps> = ({ list, header, topPad, onScrollY, empty, showStore = true, onRemoveFromSaved }) => {
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
      ListHeaderComponent={header ?? (topPad ? <View style={styles.topPad} /> : undefined)}
      onScroll={onScrollY ? e => onScrollY(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={onScrollY ? 32 : undefined}
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

