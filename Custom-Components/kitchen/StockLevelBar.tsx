// StockLevelBar — an ingredient's row: on hand against its restock level,
// a bar coloured by state (in stock, running low, out, below zero), and
// when stock expires soon. The words carry it; the bar is a glance.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { StatusPill } from '../StatusPill';
import { ExpiryChip } from './ExpiryChip';
import { useToneColors } from './kitchenShared';
import { STOCK_STATE } from '../../models/kitchen/kitchenStatusModel';
import { fillOf, parLabel } from '../../models/kitchen/stockModel';
import type { Ingredient } from '../../models/kitchen';

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    name: { flex: 1 },
    track: { height: size.stockBar, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, overflow: 'hidden', marginTop: space.s8 },
    fill: { height: '100%', borderRadius: radius.pill },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8, marginTop: space.s8 },
  });

export const StockLevelBar: React.FC<{ ingredient: Ingredient; today: string; onPress?: () => void }> = ({ ingredient: i, today, onPress }) => {
  const styles = useStyles(makeStyles);
  const state = STOCK_STATE[i.state];
  const tone = useToneColors()(state.tone);
  const fill = fillOf(i);
  return (
    <Card onPress={onPress} accessibilityLabel={`${i.name}, ${parLabel(i)}, ${state.label}${i.expiring ? `, expiring ${i.expiring.on}` : ''}`}>
      <View style={styles.head}>
        <AppText variant="title" numberOfLines={1} style={styles.name}>
          {i.name}
        </AppText>
        {i.state !== 'ok' ? <StatusPill label={state.label} tone={state.tone} /> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill > 0 ? Math.max(fill * 100, 3) : 0}%`, backgroundColor: tone.fg }]} />
      </View>
      <View style={styles.foot}>
        <AppText variant="small" tone="muted">
          {parLabel(i)}
        </AppText>
        {i.expiring ? <ExpiryChip on={i.expiring.on} today={today} /> : null}
      </View>
    </Card>
  );
};

export default StockLevelBar;
