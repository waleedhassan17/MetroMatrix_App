// MetroMatrix — One customer review (the FYP's): who wrote it beside their
// initials, a "Verified purchase" tag, the stars and when; what they said,
// their photos, and the store's reply under it.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Avatar, IonIcon, Stars } from '../../Custom-Components/index';
import type { Review } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDate } from '../../utils/dates/dates';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8, paddingVertical: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    who: { flex: 1, gap: space.s4 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexWrap: 'wrap' },
    verified: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s8,
      paddingVertical: space.s0,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
    },
    photos: { gap: space.s8 },
    photo: { width: size.lineThumb, height: size.lineThumb, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    reply: { gap: space.s4, padding: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

export const ReviewItem: React.FC<{ review: Review; storeName: string; onPhoto?: (uri: string) => void }> = ({ review, storeName, onPhoto }) => {
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Avatar name={review.authorName} size="md" />
        <View style={styles.who}>
          <View style={styles.line}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {review.authorName}
            </AppText>
            {review.verified ? (
              <View style={styles.verified}>
                <IonIcon name="checkmark-circle" size="sm" color={colors.success} />
                <AppText variant="micro" tone="success">
                  Verified purchase
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={styles.line}>
            <Stars rating={review.rating} />
            <AppText variant="caption" tone="muted">
              {formatDate(review.createdAt)}
            </AppText>
          </View>
        </View>
      </View>
      {review.title ? <AppText variant="bodyStrong">{review.title}</AppText> : null}
      {review.body ? <AppText variant="body">{review.body}</AppText> : null}
      {review.photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {review.photos.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} onPress={() => onPhoto?.(uri)} accessibilityRole="imagebutton" accessibilityLabel={`Review photo ${i + 1}`}>
              <Image source={{ uri: cdn(uri, { w: size.lineThumb * 2, h: size.lineThumb * 2 }) ?? undefined }} style={styles.photo} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {review.reply ? (
        <View style={styles.reply}>
          <AppText variant="small" tone="accentDeep">
            {storeName} replied
          </AppText>
          <AppText variant="small">{review.reply.body}</AppText>
        </View>
      ) : null}
    </View>
  );
};

export default ReviewItem;
