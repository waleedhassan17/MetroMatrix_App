// ═══════════════════════════════════════════════════════
// ReviewSummary — how patients rate the doctor, measured
// ═══════════════════════════════════════════════════════
// The average with its stars and the per-star bars (tap a bar to filter),
// dimension scores (Diagnosis, Staff, Clinic environment) and the tags
// patients chose most, with counts.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DoctorReviewSummary } from '../../models/health';
import { AppText } from '../AppText';
import { RatingBreakdown } from '../shopping/RatingBreakdown';

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s16 },
    dims: { gap: space.s8 },
    dim: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    dimLabel: { flex: 1 },
    track: { flex: 1, height: size.ratingBar, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    tag: { paddingHorizontal: space.s12, paddingVertical: space.s4, borderRadius: radius.pill, borderWidth: size.border, borderColor: colors.line },
  });

export const ReviewSummary: React.FC<{
  summary: DoctorReviewSummary;
  selected?: number | null;
  onSelect?: (rating: number | null) => void;
}> = ({ summary, selected, onSelect }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  if (!summary.count || summary.average === null) {
    return (
      <AppText variant="body" tone="muted">
        No reviews yet. Reviews come only from patients who had a visit.
      </AppText>
    );
  }
  const counts = [0, 1, 2, 3, 4].map(i => summary.distribution[i] ?? 0) as [number, number, number, number, number];
  return (
    <View style={styles.root}>
      <RatingBreakdown summary={{ average: summary.average, count: summary.count, counts, withPhotos: 0 }} selected={selected} onSelect={onSelect} />
      {summary.recommendPct !== null ? (
        <AppText variant="small" tone="muted">
          {summary.recommendPct}% of patients would recommend this doctor
        </AppText>
      ) : null}
      {summary.dimensions.length ? (
        <View style={styles.dims}>
          {summary.dimensions.map(d => (
            <View key={d.key} style={styles.dim} accessible accessibilityLabel={`${d.label}: ${d.score} out of 5`}>
              <AppText variant="small" style={styles.dimLabel}>
                {d.label}
              </AppText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${((d.score ?? 0) / 5) * 100}%`, backgroundColor: service.accent }]} />
              </View>
              <AppText variant="small" tone="muted">
                {(d.score ?? 0).toFixed(1)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {summary.tags.length ? (
        <View style={styles.tags}>
          {summary.tags.map(t => (
            <View key={t.label} style={styles.tag}>
              <AppText variant="caption">
                {t.label} <AppText variant="caption" tone="muted">{t.count}</AppText>
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default ReviewSummary;
