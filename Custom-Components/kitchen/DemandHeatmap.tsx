// DemandHeatmap — where people nearby searched for food, by area: each grid
// cell shaded by how many searched, outlined when most of them found nothing
// open. Areas with few searches are never shown (the data is anonymous and
// grouped). Filters for cuisine and hour sit above, the legend below.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { FoodMap, type MapCell, type MapPoint } from '../food/map/FoodMap';

export interface DemandCell {
  id: string;
  sw: MapPoint;
  ne: MapPoint;
  searches: number;
  /** 0–1: the share that found nothing open. */
  unmetShare: number;
}

/** Outlined from this share of searches that found nothing open. */
export const UNMET_OUTLINE = 0.5;

const makeStyles = ({ space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s12 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16, alignItems: 'center' },
    key: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    swatch: { width: space.s16, height: space.s16, borderRadius: radius.sm },
    outline: { width: space.s16, height: space.s16, borderRadius: radius.sm, borderWidth: size.focusBorder },
  });

export const DemandHeatmap: React.FC<{ cells: DemandCell[]; center: MapPoint; zoom?: number; height?: number; filters?: React.ReactNode; minCount: number }> = ({
  cells,
  center,
  zoom = 13,
  height,
  filters,
  minCount,
}) => {
  const styles = useStyles(makeStyles);
  const { size, service } = useTheme();
  const max = Math.max(1, ...cells.map(c => c.searches));
  const shown: MapCell[] = cells.map(c => ({ id: c.id, sw: c.sw, ne: c.ne, strength: 0.15 + 0.85 * (c.searches / max), outlined: c.unmetShare >= UNMET_OUTLINE }));
  const unmet = cells.filter(c => c.unmetShare >= UNMET_OUTLINE).length;
  return (
    <View style={styles.root}>
      {filters}
      <FoodMap
        pins={[]}
        cells={shown}
        view={{ center, zoom }}
        height={height ?? size.heatmap}
        accessibilityLabel={`Demand map: ${cells.length} areas with searches${unmet ? `, ${unmet} where most found nothing open` : ''}`}
      />
      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={[styles.swatch, { backgroundColor: service.accentSoft }]} />
          <AppText variant="caption" tone="muted">
            Fewer searches
          </AppText>
        </View>
        <View style={styles.key}>
          <View style={[styles.swatch, { backgroundColor: service.accent }]} />
          <AppText variant="caption" tone="muted">
            More searches
          </AppText>
        </View>
        <View style={styles.key}>
          <View style={[styles.outline, { borderColor: service.accentDeep }]} />
          <AppText variant="caption" tone="muted">
            Most found nothing open
          </AppText>
        </View>
      </View>
      <AppText variant="caption" tone="muted">
        Data is anonymous and grouped. Areas with under {minCount} searches are not shown.
      </AppText>
    </View>
  );
};

export default DemandHeatmap;
