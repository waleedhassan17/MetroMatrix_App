// RatingBreakdown — the average, its stars, and a bar per star count. Each
// bar is also a filter: tap 4 to read only the four-star reviews.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { ReviewSummary } from '../../types/shopping';
import { AppText } from '../AppText';
import { Stars } from './Stars';

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', gap: space.s24, alignItems: 'center' },
    score: { alignItems: 'center', gap: space.s4 },
    bars: { flex: 1, gap: space.s4 },
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.icon.lg, borderRadius: radius.sm },
    track: { flex: 1, height: size.ratingBar, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
    n: { minWidth: space.s24, textAlign: 'right' },
  });

export const RatingBreakdown: React.FC<{
  summary: ReviewSummary;
  selected?: number | null;
  onSelect?: (rating: number | null) => void;
}> = ({ summary, selected, onSelect }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const max = Math.max(1, ...summary.counts);
  return (
    <View style={styles.root}>
      <View style={styles.score}>
        <AppText variant="display">{summary.average.toFixed(1)}</AppText>
        <Stars rating={summary.average} />
        <AppText variant="caption" tone="muted">
          {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
        </AppText>
      </View>
      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map(star => {
          const n = summary.counts[star - 1];
          const on = selected === star;
          return (
            <Pressable
              key={star}
              onPress={() => onSelect?.(on ? null : star)}
              disabled={!onSelect || n === 0}
              accessibilityRole={onSelect ? 'button' : undefined}
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${star} stars, ${n} ${n === 1 ? 'review' : 'reviews'}${onSelect ? (on ? '. Showing these' : '. Show these') : ''}`}
              style={styles.bar}>
              <AppText variant="caption" tone={on ? 'accentDeep' : 'muted'}>
                {star}
              </AppText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(n / max) * 100}%`, backgroundColor: on ? service.accent : colors.star }]} />
              </View>
              <AppText variant="caption" tone="muted" style={styles.n}>
                {n}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default RatingBreakdown;
