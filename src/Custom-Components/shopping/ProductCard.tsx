// ═══════════════════════════════════════════════════════
// ProductCard — the catalogue's unit: a 4:5 photo first, then the facts
// ═══════════════════════════════════════════════════════
// The photo leads (it sells the product); the sale percentage and the heart
// float on it in glass so they read on any image. Below: the store, the
// name in two lines at most, the price, and the rating when there is one.
// A sold-out product stays visible but says so.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { ProductSummary } from '../../types/shopping';
import { cdn } from '../../utils/cdn';
import { discountPercent, formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { Skeleton } from '../Skeleton';
import { PriceTag } from './PriceTag';

export interface ProductCardProps {
  product: ProductSummary;
  onPress: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  /** Fixed width (a horizontal rail); a grid cell fills its column. */
  width?: number;
  /** Hide the store line inside that store's own page. */
  showStore?: boolean;
}

/** The image width requested from the CDN when a grid cell's width is unknown. */
const GRID_IMAGE = 200;

const makeStyles = ({ colors, radius, space, size, opacity }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    frame: {
      width: '100%',
      aspectRatio: size.productAspect,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSunk,
    },
    image: { width: '100%', height: '100%' },
    soldOut: { opacity: opacity.soldOut },
    badge: {
      position: 'absolute',
      top: space.s8,
      left: space.s8,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
    heart: {
      position: 'absolute',
      top: space.s4,
      right: space.s4,
      width: size.touch,
      height: size.touch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heartWell: {
      width: size.chevronWell,
      height: size.chevronWell,
      borderRadius: radius.pill,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stockTag: {
      position: 'absolute',
      left: space.s8,
      bottom: space.s8,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
      backgroundColor: colors.glass,
    },
    text: { gap: space.s4 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  saved,
  onToggleSave,
  width,
  showStore = true,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, opacity, size, motion } = useTheme();
  const off = discountPercent(product.price, product.compareAtPrice);
  const uri = cdn(product.imageUrl, {
    w: width ?? GRID_IMAGE,
    h: (width ?? GRID_IMAGE) / size.productAspect,
  });
  const label = [
    product.name,
    showStore ? product.storeName : null,
    formatPKR(product.price),
    off ? `${off}% off` : null,
    product.inStock ? null : 'sold out',
  ]
    .filter(Boolean)
    .join(', ');

  // The heart is the card's sibling, not its child: one button may not hold another.
  return (
    <View style={width ? { width } : null}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
        <View style={styles.frame}>
          {uri ? (
            <Image
              source={{ uri }}
              style={[styles.image, !product.inStock && styles.soldOut]}
              contentFit="cover"
              transition={motion.imageFade}
              recyclingKey={product.id}
            />
          ) : null}
          {off > 0 ? (
            <View style={[styles.badge, { backgroundColor: service.accent }]}>
              <AppText variant="chip" tone="onAccent">
                −{off}%
              </AppText>
            </View>
          ) : product.isNew ? (
            <View style={[styles.badge, { backgroundColor: colors.glass }]}>
              <AppText variant="tag">NEW</AppText>
            </View>
          ) : null}
          {!product.inStock ? (
            <View style={styles.stockTag}>
              <AppText variant="chip">Sold out</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.text}>
          {showStore && product.storeName ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {product.storeName}
            </AppText>
          ) : null}
          <AppText variant="small" numberOfLines={2}>
            {product.name}
          </AppText>
          <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} />
          {product.ratingCount > 0 ? (
            <View style={styles.rating}>
              <IonIcon name="star" size="sm" color={colors.star} />
              <AppText variant="caption" tone="muted">
                {product.rating.toFixed(1)} ({product.ratingCount})
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
      {onToggleSave ? (
        <Pressable
          onPress={onToggleSave}
          style={styles.heart}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityState={{ selected: !!saved }}
          accessibilityLabel={saved ? `Remove ${product.name} from Saved` : `Save ${product.name}`}>
          <View style={styles.heartWell}>
            <IonIcon
              name={saved ? 'heart' : 'heart-outline'}
              size="md"
              color={saved ? colors.danger : colors.ink}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

/** The card's shape while the page loads. */
export const ProductCardSkeleton: React.FC<{ width?: number }> = ({ width }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.root, width ? { width } : null]}>
      <View style={styles.frame} />
      <View style={styles.text}>
        <Skeleton width="50%" />
        <Skeleton width="90%" />
        <Skeleton width="40%" />
      </View>
    </View>
  );
};

export default ProductCard;
