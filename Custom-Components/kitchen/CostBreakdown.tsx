// CostBreakdown — "Cost to make Rs 312 · You sell Rs 650 · You keep Rs 338
// (52%)", with the food cost against the kitchen's target in a pill (red
// only when it is over).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { StatusPill } from '../StatusPill';
import { foodCostLabel } from '../../models/kitchen/costingModel';
import { formatPKR } from '../../utils/money/money';
import type { Cost } from '../../models/kitchen';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    figures: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
    figure: { gap: space.s4 },
  });

export const CostBreakdown: React.FC<{ cost: Cost; targetPct: number; compact?: boolean }> = ({ cost, targetPct, compact }) => {
  const styles = useStyles(makeStyles);
  const pill = <StatusPill label={foodCostLabel(cost, targetPct)} tone={cost.overTarget ? 'danger' : 'success'} />;
  if (compact) {
    return (
      <View style={styles.root} accessible accessibilityLabel={`Cost to make ${formatPKR(cost.toMake)}, you keep ${formatPKR(cost.keep)}, ${foodCostLabel(cost, targetPct)}`}>
        <AppText variant="small" tone="muted">
          Cost to make {formatPKR(cost.toMake)} · You keep {formatPKR(cost.keep)} ({cost.keepPct}%)
        </AppText>
        {pill}
      </View>
    );
  }
  const figure = (label: string, value: string, strong?: boolean) => (
    <View style={styles.figure}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant={strong ? 'cardTitle' : 'title'}>{value}</AppText>
    </View>
  );
  return (
    <View style={styles.root} accessible accessibilityLabel={`Cost to make ${formatPKR(cost.toMake)}. You sell for ${formatPKR(cost.sellPrice)}. You keep ${formatPKR(cost.keep)}, ${cost.keepPct} percent. ${foodCostLabel(cost, targetPct)}.`}>
      <View style={styles.figures}>
        {figure('Cost to make', formatPKR(cost.toMake))}
        {figure('You sell', formatPKR(cost.sellPrice))}
        {figure(`You keep (${cost.keepPct}%)`, formatPKR(cost.keep), true)}
      </View>
      {pill}
    </View>
  );
};

export default CostBreakdown;
