// SurplusCard — a Bachat Box near the customer: the photo, the kitchen,
// what the food is worth against what it costs, the pickup window today and
// how many are left.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { StatusPill } from '../StatusPill';
import { cdn } from '../../utils/cdn/cdn';
import { formatPKR } from '../../utils/money/money';
import { BACHAT_BOX, discountLabel } from '../../models/kitchen/surplusModel';
import type { SurplusCard as SurplusCardData } from '../../models/kitchen';

const makeStyles = ({ space, size, radius, colors, elevation }: Theme) =>
  StyleSheet.create({
    root: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...elevation.card },
    rail: { width: size.surplusCard },
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, backgroundColor: colors.surfaceSunk },
    tag: { position: 'absolute', left: space.s12, top: space.s12 },
    body: { padding: space.s12, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
    price: { flexDirection: 'row', alignItems: 'baseline', gap: space.s8, flexWrap: 'wrap' },
  });

export const SurplusCard: React.FC<{ card: SurplusCardData; onPress: () => void; rail?: boolean }> = ({ card, onPress, rail }) => {
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const left = card.left === 1 ? '1 left' : `${card.left} left`;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.root, rail && styles.rail]}
      accessibilityRole="button"
      accessibilityLabel={`${BACHAT_BOX} from ${card.vendor.name}: ${card.title}. ${formatPKR(card.value)} value for ${formatPKR(card.price)}. ${card.pickupLabel}. ${left}.`}>
      <View>
        <Image source={cdn(card.photoUrl, { w: size.surplusCard, h: Math.round(size.surplusCard / size.railPhotoAspect) }) ?? undefined} style={styles.photo} contentFit="cover" />
        <View style={styles.tag}>
          <StatusPill label={`${BACHAT_BOX} · ${discountLabel(card.value, card.price)}`} tone="success" />
        </View>
      </View>
      <View style={styles.body}>
        <AppText variant="title" numberOfLines={1}>
          {card.vendor.name}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {card.title}
          {card.vendor.distanceKm !== null ? ` · ${card.vendor.distanceKm} km` : ''}
        </AppText>
        <View style={styles.price}>
          <AppText variant="bodyStrong">{formatPKR(card.price)}</AppText>
          <AppText variant="small" tone="muted">
            {formatPKR(card.value)} value
          </AppText>
        </View>
        <View style={styles.row}>
          <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.grow}>
            {card.pickupLabel}
          </AppText>
          <AppText variant="caption" tone={card.left <= 2 ? 'warning' : 'muted'}>
            {left}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
};

export default SurplusCard;
