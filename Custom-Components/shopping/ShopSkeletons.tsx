// ShopSkeletons — each Shopping page's loading shape, so nothing jumps when
// the content lands: a Bag group, an order card, checkout, the product page
// (its gallery at full height), a store's cover, a list row card, the
// store's stat tiles and the category rail. Skeleton blocks only.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { Card } from '../Card';
import { Skeleton } from '../Skeleton';

const makeStyles = ({ space, size, gutter, radius, colors }: Theme) =>
  StyleSheet.create({
    stack: { gap: space.s16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    top: { flexDirection: 'row', gap: space.s12 },
    grow: { flex: 1, gap: space.s8 },
    gallery: { width: '100%', aspectRatio: size.productPhotoAspect, backgroundColor: colors.surfaceSunk },
    hero: { height: size.storeHero, backgroundColor: colors.surfaceSunk },
    pad: { paddingHorizontal: gutter, gap: space.s12, paddingTop: space.s20 },
    rail: { flexDirection: 'row', gap: space.s12, paddingHorizontal: gutter },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '28%', padding: space.s16, gap: space.s8, borderRadius: radius.lg, backgroundColor: colors.surface },
  });

const a11y = { accessibilityLabel: 'Loading', accessibilityRole: 'progressbar' as const };

/** A store's part of the Bag: head, two lines, the foot. */
export const BagGroupSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        <Skeleton width={size.logoMark} height={size.logoMark} shape="pill" />
        <View style={styles.grow}>
          <Skeleton width="45%" />
        </View>
      </View>
      {[0, 1].map(i => (
        <View key={i} style={styles.top}>
          <Skeleton width={size.lineThumb} height={size.lineThumb / size.productAspect} shape="md" />
          <View style={styles.grow}>
            <Skeleton width="80%" />
            <Skeleton width="40%" />
            <Skeleton width="30%" />
          </View>
        </View>
      ))}
    </Card>
  );
};

/** An order in a list. */
export const OrderCardSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        <Skeleton width={size.logoMark} height={size.logoMark} shape="pill" />
        <View style={styles.grow}>
          <Skeleton width="55%" />
          <Skeleton width="35%" />
        </View>
        <Skeleton width={size.tile} height={size.countBadge + size.focusBorder * 2} shape="pill" />
      </View>
      <View style={styles.row}>
        {[0, 1, 2].map(i => (
          <Skeleton key={i} width={size.thumb} height={size.thumb / size.productAspect} shape="md" />
        ))}
      </View>
    </Card>
  );
};

/** A list entry card (the store's orders, products, returns). */
export const RowCardSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        <Skeleton width={size.avatar.md} height={size.avatar.md} shape="md" />
        <View style={styles.grow}>
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </View>
      </View>
    </Card>
  );
};

/** Several row cards, for a list's first page. */
export const RowCardsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stack} {...a11y}>
      {Array.from({ length: count }, (_, i) => (
        <RowCardSkeleton key={i} />
      ))}
    </View>
  );
};

/** Checkout: the step card, then two section cards. */
export const CheckoutSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.stack} {...a11y}>
      <Card>
        <Skeleton width="70%" />
        <Skeleton height={size.stepBar} shape="pill" />
      </Card>
      <BagGroupSkeleton />
      <BagGroupSkeleton />
    </View>
  );
};

/** The product page: the gallery at its real height, then the facts. */
export const ProductDetailSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { type } = useTheme();
  return (
    <View {...a11y}>
      <View style={styles.gallery} />
      <View style={styles.pad}>
        <Skeleton width="35%" />
        <Skeleton width="85%" height={type.cardTitle.lineHeight as number} />
        <Skeleton width="40%" height={type.price.lineHeight as number} />
        <Skeleton width="60%" />
      </View>
    </View>
  );
};

/** A store's cover hero. */
export const StoreHeroSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  return <View style={styles.hero} {...a11y} />;
};

/** The store's Today tiles. */
export const StatGridSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const styles = useStyles(makeStyles);
  const { size, elevation } = useTheme();
  return (
    <View style={styles.grid} {...a11y}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.tile, elevation.card]}>
          <Skeleton width={size.statWell} height={size.statWell} shape="md" />
          <Skeleton width="50%" height={size.subTypeTile} />
        </View>
      ))}
    </View>
  );
};

/** The home's "Shop by category" rail. */
export const CategoryRailSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.rail} {...a11y}>
      {[0, 1, 2, 3].map(i => (
        <Skeleton key={i} width={size.categoryTile.width} height={size.categoryTile.height} shape="lg" />
      ))}
    </View>
  );
};
