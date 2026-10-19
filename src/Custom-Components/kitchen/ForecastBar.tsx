// ForecastBar — a dish's expected number with its likely range as a soft
// band, "Learning" while there is little history, and − / + to set the
// kitchen's own number (it replaces the forecast in the prep sheet).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { StatusPill } from '../StatusPill';
import { TextAction } from '../TextAction';
import { adjustmentLabel, barPositions, plannedOf, rangeLabel } from '../../models/kitchen/forecastModel';
import type { ForecastItem } from '../../types/kitchen';

const makeStyles = ({ space, size, radius, colors, service }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8, paddingVertical: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    name: { flex: 1 },
    track: { height: size.forecastBar, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
    band: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: service.accentSoft },
    mark: { position: 'absolute', top: 0, bottom: 0, width: size.focusBorder * 2, borderRadius: radius.pill, backgroundColor: service.accent },
    own: { position: 'absolute', top: -size.focusBorder, bottom: -size.focusBorder, width: size.focusBorder * 2, borderRadius: radius.pill, backgroundColor: colors.ink },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

export interface ForecastBarProps {
  item: ForecastItem;
  /** The longest bar on the list: every bar uses the same scale. */
  max: number;
  onAdjust?: (n: number | null) => void;
  busy?: boolean;
}

export const ForecastBar: React.FC<ForecastBarProps> = ({ item, max, onAdjust, busy }) => {
  const styles = useStyles(makeStyles);
  const at = barPositions(item, max);
  const planned = plannedOf(item);
  const own = adjustmentLabel(item);
  const fixed = item.fixed.tiffin + item.fixed.catering;
  const current = item.adjusted ?? item.expected;
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <AppText variant="title" numberOfLines={1} style={styles.name}>
          {item.name}
        </AppText>
        {item.learning ? <StatusPill label="Learning" /> : null}
        <AppText variant="title">{planned}</AppText>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${item.name}: expected ${item.expected}, likely ${rangeLabel(item)}${item.adjusted !== null ? `, you set ${item.adjusted}` : ''}`}>
        <View style={[styles.band, { left: `${at.low * 100}%`, width: `${Math.max(2, (at.high - at.low) * 100)}%` }]} />
        <View style={[styles.mark, { left: `${at.expected * 100}%` }]} />
        {at.adjusted !== null ? <View style={[styles.own, { left: `${at.adjusted * 100}%` }]} /> : null}
      </View>
      <View style={styles.foot}>
        <AppText variant="small" tone="muted">
          Expected {item.expected} ({rangeLabel(item)}){own ? ` · ${own}` : ''}
          {fixed ? ` · ${fixed} fixed (tiffin and catering)` : ''}
        </AppText>
        {onAdjust ? (
          <View style={styles.stepper}>
            <IconButton icon="remove" tone="muted" onPress={() => onAdjust(Math.max(0, current - 1))} disabled={busy || current <= 0} accessibilityLabel={`One fewer ${item.name}`} />
            <IconButton icon="add" tone="muted" onPress={() => onAdjust(current + 1)} disabled={busy} accessibilityLabel={`One more ${item.name}`} />
            {item.adjusted !== null ? <TextAction label="Reset" tone="muted" onPress={() => onAdjust(null)} disabled={busy} accessibilityLabel={`Use the forecast for ${item.name}`} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default ForecastBar;
