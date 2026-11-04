// LineItemRow — one bought or bagged item: the 72 pt photo (4:5), its name in
// two lines, a muted line (size, colour, quantity), the price, and anything
// the screen adds under it (a stepper, "Write a review") or at its end.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { cdn } from '../../utils/cdn/cdn';
import { AppText } from '../AppText';

export interface LineItemRowProps {
  imageUrl: string | null;
  name: string;
  /** "Size M · Black · × 2" */
  meta?: string | null;
  /** Already formatted (formatPKR). */
  price?: string | null;
  /** The Bag and checkout show the price in the accent; an order in ink. */
  priceTone?: 'accent' | 'ink';
  /** A sold-out line: the photo dims. */
  soldOut?: boolean;
  onOpen?: () => void;
  /** At the row's end, top-aligned (a line total, a checkbox). */
  right?: React.ReactNode;
  /** Under the text (warnings, a stepper, "Write a review"). */
  children?: React.ReactNode;
  /** `square`: a dish's photo (Food Court); `none`: a line with no photo (a kitchen's ticket). */
  shape?: 'portrait' | 'square' | 'none';
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.s12 },
    thumb: {
      width: size.lineThumb,
      aspectRatio: size.productAspect,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
      overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    body: { flex: 1, gap: space.s4 },
  });

export const LineItemRow: React.FC<LineItemRowProps> = ({
  imageUrl,
  name,
  meta,
  price,
  priceTone = 'accent',
  soldOut,
  onOpen,
  right,
  children,
  shape = 'portrait',
}) => {
  const styles = useStyles(makeStyles);
  const { size, opacity, motion } = useTheme();
  const aspect = shape === 'square' ? 1 : size.productAspect;
  const uri = cdn(imageUrl, { w: size.lineThumb * 2, h: (size.lineThumb * 2) / aspect });
  const thumb = shape === 'none' ? null : (
    <View style={[styles.thumb, { aspectRatio: aspect }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, soldOut && { opacity: opacity.soldOut }]} contentFit="cover" transition={motion.imageFade} />
      ) : null}
    </View>
  );
  return (
    <View style={styles.row}>
      {onOpen && thumb ? (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
          {thumb}
        </Pressable>
      ) : (
        thumb
      )}
      <View style={styles.body}>
        <AppText variant="small" numberOfLines={2}>
          {name}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
        {price ? (
          <AppText variant="bodyStrong" tone={priceTone === 'accent' ? 'accentDeep' : 'ink'}>
            {price}
          </AppText>
        ) : null}
        {children}
      </View>
      {right ?? null}
    </View>
  );
};

export default LineItemRow;
