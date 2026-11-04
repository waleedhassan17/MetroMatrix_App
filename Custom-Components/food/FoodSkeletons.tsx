// FoodSkeletons — each Food page's loading shape, so nothing jumps when the
// content lands: a kitchen card in a list, the kitchen's page (its cover at
// full width, the identity, the facts strip, dish rows), the menu, a board
// ticket and the live order. Lists, stats and checkout reuse ShopSkeletons.

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { Card } from '../Card';
import { Skeleton } from '../Skeleton';

const makeStyles = ({ space, size, gutter, colors, radius }: Theme) =>
  StyleSheet.create({
    stack: { gap: space.s16 },
    card: { marginHorizontal: gutter, gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s8 },
    cover: { width: '100%', aspectRatio: size.vendorCoverAspect, backgroundColor: colors.surfaceSunk },
    identity: { paddingHorizontal: gutter, gap: space.s12, marginTop: -size.avatar.lg / 2 },
    logo: { width: size.avatar.lg, height: size.avatar.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, borderWidth: size.focusBorder, borderColor: colors.surface },
    dishes: { paddingHorizontal: gutter, gap: space.s20, paddingTop: space.s8 },
    dish: { flexDirection: 'row', gap: space.s12 },
    actions: { flexDirection: 'row', gap: space.s12 },
  });

const a11y = { accessibilityLabel: 'Loading', accessibilityRole: 'progressbar' as const };

/** A kitchen in a list: the full-width food photo, then three lines. */
export const VendorCardSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  const styles = useStyles(makeStyles);
  const { size, gutter } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={styles.stack} {...a11y}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton height={(width - gutter * 2) / size.vendorPhotoAspect} shape="lg" />
          <Skeleton width="55%" />
          <Skeleton width="40%" />
        </View>
      ))}
    </View>
  );
};

/** Dish rows on a menu: two lines of text beside the square photo. */
export const MenuSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.dishes} {...a11y}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.dish}>
          <View style={styles.grow}>
            <Skeleton width="70%" />
            <Skeleton width="90%" />
            <Skeleton width="30%" />
          </View>
          <Skeleton width={size.dishPhoto} height={size.dishPhoto} shape="lg" />
        </View>
      ))}
    </View>
  );
};

/** The kitchen's page: its cover at full width, the logo and name, the facts, dish rows. */
export const VendorPageSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View {...a11y}>
      <View style={styles.cover} />
      <View style={styles.identity}>
        <View style={styles.logo} />
        <Skeleton width="60%" height={size.icon.lg} />
        <Skeleton width="45%" />
        <Skeleton height={size.control.lg} shape="lg" />
      </View>
      <MenuSkeleton />
    </View>
  );
};

/** A ticket on the kitchen's board: the head, the dishes, the buttons. */
export const TicketSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.stack} {...a11y}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Skeleton width="40%" />
              <Skeleton width="25%" />
            </View>
            <Skeleton width={size.avatar.lg} height={size.countBadge + size.focusBorder * 2} shape="pill" />
          </View>
          <Skeleton width="85%" />
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Skeleton height={size.touch} shape="pill" />
            </View>
            <View style={styles.grow}>
              <Skeleton height={size.touch} shape="pill" />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
};

/** The live order: the progress card, then the order card. */
export const OrderTrackSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  return (
    <View style={styles.stack} {...a11y}>
      <Card>
        <Skeleton width="35%" />
        <Skeleton width="65%" height={size.icon.lg} />
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={styles.row}>
            <Skeleton width={size.timelineDot} height={size.timelineDot} shape="pill" />
            <View style={styles.grow}>
              <Skeleton width="50%" />
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <View style={styles.row}>
          <Skeleton width={size.logoMark} height={size.logoMark} shape="pill" />
          <View style={styles.grow}>
            <Skeleton width="50%" />
          </View>
        </View>
        <Skeleton width="80%" />
        <Skeleton width="60%" />
      </Card>
    </View>
  );
};
