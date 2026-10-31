// StatTrio — Satisfaction · Wait · Reviews, each with a caption. A stat the
// API leaves out (too few visits to measure) is simply not shown.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import type { DoctorStats } from '../../models/health';
import { AppText } from '../AppText';

const makeStyles = ({ space, colors, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
    cell: { flex: 1, alignItems: 'center', gap: space.s4, paddingVertical: space.s12, paddingHorizontal: space.s8 },
    rule: { width: size.hairline, backgroundColor: colors.line },
  });

export const StatTrio: React.FC<{ stats: DoctorStats }> = ({ stats }) => {
  const styles = useStyles(makeStyles);
  const cells = [
    stats.satisfactionPct !== null ? { value: `${stats.satisfactionPct}%`, caption: 'Satisfied patients' } : null,
    stats.waitMinutes !== null ? { value: `~${stats.waitMinutes} min`, caption: 'Measured wait' } : null,
    { value: stats.reviewCount.toLocaleString('en-US'), caption: stats.reviewCount === 1 ? 'Review' : 'Reviews' },
  ].filter((c): c is { value: string; caption: string } => c !== null);
  return (
    <View style={styles.root}>
      {cells.map((c, i) => (
        <React.Fragment key={c.caption}>
          {i > 0 ? <View style={styles.rule} /> : null}
          <View style={styles.cell} accessible accessibilityLabel={`${c.caption}: ${c.value}`}>
            <AppText variant="title">{c.value}</AppText>
            <AppText variant="caption" tone="muted" align="center">
              {c.caption}
            </AppText>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
};

export default StatTrio;
