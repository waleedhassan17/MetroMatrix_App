// MetroMatrix — A kitchen's rating: the average and how many rated it, a
// bar for each star, and what people mention most.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, ProgressBar, Stars } from '../index';
import { FOOD_REVIEW_TAG_LABEL, ratingCountLabel, starShares } from '../../models/food/reviewModel';
import type { FoodRatingSummary } from '../../types';

const makeStyles = ({ colors, space, radius }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s12 },
    top: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    score: { alignItems: 'center', gap: space.s4 },
    bars: { flex: 1, gap: space.s4 },
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    barFill: { flex: 1 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    tag: { paddingHorizontal: space.s12, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
  });

export const RatingSummary: React.FC<{ summary: FoodRatingSummary }> = ({ summary: s }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.score} accessible accessibilityLabel={`Rated ${s.ratingAvg.toFixed(1)} of 5 from ${ratingCountLabel(s.ratingCount)}`}>
          <AppText variant="h1">{s.ratingAvg.toFixed(1)}</AppText>
          <Stars rating={s.ratingAvg} />
          <AppText variant="caption" tone="muted">
            {ratingCountLabel(s.ratingCount)}
          </AppText>
        </View>
        <View style={styles.bars}>
          {starShares(s).map(x => (
            <View key={x.stars} style={styles.bar}>
              <AppText variant="caption" tone="muted">
                {x.stars}
              </AppText>
              <View style={styles.barFill}>
                <ProgressBar progress={x.share} accessibilityLabel={`${x.stars} stars: ${x.count}`} />
              </View>
            </View>
          ))}
        </View>
      </View>
      {s.topTags.length ? (
        <View style={styles.tags} accessibilityLabel="What people mention">
          {s.topTags.map(t => (
            <View key={t.tag} style={styles.tag}>
              <AppText variant="caption">{`${FOOD_REVIEW_TAG_LABEL[t.tag]} · ${t.count}`}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default RatingSummary;
