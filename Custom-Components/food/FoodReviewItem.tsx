// MetroMatrix — One Food Court review: the food's stars (and the
// delivery's), who and when, the tags, what they said, their photos, and
// the kitchen's reply under it. `footer` holds a screen's own actions
// (reply, hide).

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Stars } from '../index';
import { FOOD_REVIEW_TAG_LABEL } from '../../models/food/reviewModel';
import type { FoodReview } from '../../types';
import { cdn } from '../../utils/cdn';
import { formatDate } from '../../utils/dates';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8, paddingVertical: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexWrap: 'wrap' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    tag: { paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
    photos: { gap: space.s8 },
    photo: { width: size.thumb, height: size.thumb, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    reply: { gap: space.s4, padding: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

export const FoodReviewItem: React.FC<{
  review: FoodReview;
  vendorName: string;
  /** Overrides the author line (staff see the full name; the customer sees "You"). */
  author?: string;
  /** Under the head: which order, which vendor. */
  context?: string;
  onPhoto?: (uri: string) => void;
  footer?: React.ReactNode;
}> = ({ review: r, vendorName, author, context, onPhoto, footer }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const who = author ?? r.author ?? 'Customer';
  return (
    <View style={styles.root} accessible={!footer} accessibilityLabel={!footer ? `${who}, ${r.foodRating} of 5 stars. ${r.text ?? ''}` : undefined}>
      <View style={styles.head}>
        <Stars rating={r.foodRating} />
        <AppText variant="small">{who}</AppText>
        <AppText variant="caption" tone="muted">
          · {formatDate(r.createdAt)}
        </AppText>
      </View>
      {context ? (
        <AppText variant="caption" tone="muted">
          {context}
        </AppText>
      ) : null}
      {r.deliveryRating ? (
        <AppText variant="caption" tone="muted">
          {`Delivery ${r.deliveryRating} of 5`}
        </AppText>
      ) : null}
      {r.tags.length ? (
        <View style={styles.tags}>
          {r.tags.map(t => (
            <View key={t} style={styles.tag}>
              <AppText variant="caption">{FOOD_REVIEW_TAG_LABEL[t]}</AppText>
            </View>
          ))}
        </View>
      ) : null}
      {r.text ? <AppText variant="body">{r.text}</AppText> : null}
      {r.photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {r.photos.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} onPress={() => onPhoto?.(uri)} accessibilityRole="imagebutton" accessibilityLabel={`Review photo ${i + 1}`}>
              <Image source={{ uri: cdn(uri, { w: size.thumb, h: size.thumb }) ?? undefined }} style={styles.photo} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {r.vendorReply ? (
        <View style={styles.reply}>
          <AppText variant="small" tone="accentDeep">
            {vendorName} replied
          </AppText>
          <AppText variant="small">{r.vendorReply}</AppText>
        </View>
      ) : null}
      {footer}
    </View>
  );
};

export default FoodReviewItem;
