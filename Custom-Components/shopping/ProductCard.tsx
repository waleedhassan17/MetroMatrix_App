// ═══════════════════════════════════════════════════════
// ProductCard — the catalogue's unit: the FYP's framed card
// ═══════════════════════════════════════════════════════
// A white card with a soft shadow: the 3:4 photo first (it sells the
// product), then the facts in a block of a fixed least height, so a row of
// cards lines up whatever the names. On the photo: ONE badge (the sale, else
// "NEW") and the heart in a white circle. Below: the store in small accent
// capitals, the name in two lines at most, the price in the accent with the
// struck "was" price, and the rating when there is one. A sold-out product
// stays visible but veiled.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { ProductSummary } from '../../models/shopping';
import { cdn } from '../../utils/cdn/cdn';
import { discountPercent, formatPKR } from '../../utils/money/money';
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
const GRID_IMAGE = 240;

const makeStyles = ({ colors, radius, space, size, elevation }: Theme) =>
  StyleSheet.create({
    // The shadow lives on the outer frame; the inner one clips the photo to the
    // corners (a clip on the shadowed view would cut the shadow off on iOS).
    card: { borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
    clip: { borderRadius: radius.lg, overflow: 'hidden' },
    frame: { width: '100%', aspectRatio: size.productPhotoAspect, backgroundColor: colors.surfaceSunk },
    image: { width: '100%', height: '100%' },
    veil: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrimMid, alignItems: 'center', justifyContent: 'center' },
    tag: { paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.sm, backgroundColor: colors.glass },
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
      width: size.heartWell,
      height: size.heartWell,
      borderRadius: radius.pill,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation.input,
    },
    info: { minHeight: size.productInfo, padding: space.s12, gap: space.s4, justifyContent: 'space-between' },
    group: { gap: space.s4 },
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
  const w = width ?? GRID_IMAGE;
  const uri = cdn(product.imageUrl, { w, h: w / size.productPhotoAspect });
  const label = [
    product.name,
    showStore ? product.storeName : null,
    formatPKR(product.price),
    off ? `${off}% off` : null,
    product.ratingCount > 0 ? `rated ${product.rating.toFixed(1)}` : null,
    product.inStock ? null : 'sold out',
  ]
    .filter(Boolean)
    .join(', ');

  // The heart is the card's sibling, not its child: one button may not hold another.
  return (
    <View style={[styles.card, width ? { width } : null]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.clip, pressed && { opacity: opacity.pressed }]}>
        <View style={styles.frame}>
          {uri ? (
            <Image source={{ uri }} style={styles.image} contentFit="cover" transition={motion.imageFade} recyclingKey={product.id} />
          ) : null}
          {!product.inStock ? (
            <View style={styles.veil}>
              <View style={styles.tag}>
                <AppText variant="chip">Sold out</AppText>
              </View>
            </View>
          ) : off > 0 ? (
            <View style={[styles.badge, { backgroundColor: service.accent }]}>
              <AppText variant="chip" tone="onAccent">
                −{off}%
              </AppText>
            </View>
          ) : product.isNew ? (
            <View style={[styles.badge, { backgroundColor: colors.ink }]}>
              <AppText variant="tag" tone="onScrim">
                NEW
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.info}>
          <View style={styles.group}>
            {showStore && product.storeName ? (
              <AppText variant="overline" tone="accentDeep" numberOfLines={1}>
                {product.storeName}
              </AppText>
            ) : null}
            <AppText variant="small" numberOfLines={2}>
              {product.name}
            </AppText>
          </View>
          <View style={styles.group}>
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
        </View>
      </Pressable>
      {onToggleSave ? (
        <Pressable
          onPress={onToggleSave}
          style={styles.heart}
          hitSlop={4}
          accessibilityRole="button"
          aria-selected={!!saved}
          accessibilityLabel={saved ? `Remove ${product.name} from Saved` : `Save ${product.name}`}>
          <View style={styles.heartWell}>
            <IonIcon name={saved ? 'heart' : 'heart-outline'} size="sm" color={saved ? colors.danger : colors.ink} />
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
    <View style={[styles.card, width ? { width } : null]}>
      <View style={styles.clip}>
        <View style={styles.frame} />
        <View style={styles.info}>
          <View style={styles.group}>
            <Skeleton width="45%" />
            <Skeleton width="90%" />
          </View>
          <Skeleton width="40%" />
        </View>
      </View>
    </View>
  );
};

export default ProductCard;
