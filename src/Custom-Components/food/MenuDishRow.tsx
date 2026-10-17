// MenuDishRow — one dish on a vendor's page: name, a two-line description,
// its price ("from" with sizes), tags and "6 left today"; the photo on the
// right with the add button on it. A sold-out dish, or one outside its
// category's hours, stays visible but says why and can't be added.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { cdn } from '../../utils/cdn';
import { formatPKR } from '../../utils/money';
import { ITEM_TAG_LABEL } from '../../models/food/menuModel';
import { unavailableLabel } from '../../models/food/itemSelectionModel';
import type { DishCard } from '../../types/food';

export interface MenuDishRowProps {
  dish: DishCard;
  /** The category's window start, for "Served from 6:00 PM". */
  windowFrom?: string | null;
  /** How many of it are in the bag already. */
  inBag?: number;
  onPress: () => void;
}

const SHOWN_TAGS = ['bestseller', 'spicy', 'veg', 'new'] as const;

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s16 },
    text: { flex: 1, gap: space.s4 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    photo: { width: size.dishPhoto, height: size.dishPhoto, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    noPhoto: { width: size.dishPhoto, alignItems: 'flex-end', justifyContent: 'flex-end' },
    fill: { ...StyleSheet.absoluteFillObject },
    add: {
      position: 'absolute',
      right: space.s4,
      bottom: space.s4,
      width: size.control.sm,
      height: size.control.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    addPlain: { position: 'relative', right: space.s0, bottom: space.s0, borderWidth: size.border, borderColor: colors.line },
  });

export const MenuDishRow: React.FC<MenuDishRowProps> = ({ dish: d, windowFrom, inBag = 0, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size, opacity } = useTheme();
  const why = d.available ? null : unavailableLabel(d.unavailableReason, windowFrom);
  const price = d.hasVariants ? `from ${formatPKR(d.fromPrice)}` : formatPKR(d.fromPrice);
  const shownTags = SHOWN_TAGS.filter(t => d.tags.includes(t));
  const addButton = (
    <View style={[styles.add, !d.photoUrl && styles.addPlain]}>
      {inBag ? (
        <AppText variant="bodyStrong" tone="accentDeep">
          {inBag}
        </AppText>
      ) : (
        <IonIcon name="add" size="md" color={d.available ? service.accentDeep : colors.inkFaint} />
      )}
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      style={styles.root}
      accessibilityRole="button"
      accessibilityLabel={[d.name, price, why, d.remainingLabel, inBag ? `${inBag} in your bag` : null].filter(Boolean).join(', ')}
      accessibilityHint={d.available ? 'Opens the dish to add it' : undefined}
    >
      <View style={[styles.text, !d.available && { opacity: opacity.soldOut }]}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {d.name}
        </AppText>
        {d.description ? (
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {d.description}
          </AppText>
        ) : null}
        <AppText variant="bodyStrong" tone="accentDeep">
          {price}
        </AppText>
        {shownTags.length || d.isDeal ? (
          <View style={styles.tags}>
            {d.isDeal ? (
              <AppText variant="tag" tone="accentDeep">
                Deal
              </AppText>
            ) : null}
            {shownTags.map(t => (
              <AppText key={t} variant="tag" tone="muted">
                {ITEM_TAG_LABEL[t]}
              </AppText>
            ))}
          </View>
        ) : null}
        {why ? (
          <AppText variant="small" tone="warning">
            {why}
          </AppText>
        ) : d.remainingLabel ? (
          <AppText variant="small" tone="warning">
            {d.remainingLabel}
          </AppText>
        ) : null}
      </View>
      {d.photoUrl ? (
        <View style={[styles.photo, !d.available && { opacity: opacity.soldOut }]}>
          <Image source={{ uri: cdn(d.photoUrl, { w: size.dishPhoto, h: size.dishPhoto }) ?? undefined }} style={styles.fill} contentFit="cover" transition={150} />
          {addButton}
        </View>
      ) : (
        <View style={styles.noPhoto}>{addButton}</View>
      )}
    </Pressable>
  );
};

export default MenuDishRow;
