// QuadrantChart — the menu on two axes: how often a dish is ordered and how
// much the kitchen keeps on it. Four plain-word corners, a tappable dot per
// dish. With a screen reader on it is the list, by corner.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { ListRow } from '../ListRow';
import { useChartWidth } from '../shopping/charts/chartShared';
import { useScreenReader } from './kitchenShared';
import { QUADRANT } from '../../models/kitchen/kitchenStatusModel';

export type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface QuadrantPoint {
  id: string;
  label: string;
  /** 0–1: how often it is ordered, against the menu. */
  popularity: number;
  /** 0–1: how much is kept on it, against the menu. */
  profit: number;
  quadrant: Quadrant;
}

/** The corners' plain words (the ONE map: kitchenStatusModel). */
export const QUADRANT_LABEL: Record<Quadrant, string> = {
  star: QUADRANT.star.label,
  plowhorse: QUADRANT.plowhorse.label,
  puzzle: QUADRANT.puzzle.label,
  dog: QUADRANT.dog.label,
};
const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    plot: { height: size.quadrant },
    dot: { position: 'absolute', width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
    corner: { position: 'absolute', maxWidth: '46%' },
    axes: { flexDirection: 'row', justifyContent: 'space-between' },
  });

export const QuadrantChart: React.FC<{ points: QuadrantPoint[]; onPress: (id: string) => void }> = ({ points, onPress }) => {
  const styles = useStyles(makeStyles);
  const { size, colors, service, space, radius } = useTheme();
  const { width, onLayout } = useChartWidth();
  const reader = useScreenReader();
  const h = size.quadrant;
  const pad = space.s8;

  if (reader) {
    return (
      <View style={styles.root}>
        {(Object.keys(QUADRANT_LABEL) as Quadrant[]).map(q =>
          points
            .filter(p => p.quadrant === q)
            .map(p => <ListRow key={p.id} title={p.label} subtitle={QUADRANT_LABEL[q]} onPress={() => onPress(p.id)} />),
        )}
      </View>
    );
  }

  const x = (v: number) => pad + v * (width - pad * 2);
  // Room above and below for the corner words, so no dot sits on them.
  const padY = space.s32;
  const y = (v: number) => h - padY - v * (h - padY * 2);
  const dot = size.quadrantDot;
  return (
    <View style={styles.root}>
      <View style={styles.plot} onLayout={onLayout}>
        {width ? (
          <>
            <Svg width={width} height={h}>
              <Rect x={0} y={0} width={width} height={h} fill={colors.surface} stroke={colors.line} strokeWidth={size.border} rx={radius.lg} />
              <Line x1={width / 2} y1={pad} x2={width / 2} y2={h - pad} stroke={colors.line} strokeWidth={size.border} />
              <Line x1={pad} y1={h / 2} x2={width - pad} y2={h / 2} stroke={colors.line} strokeWidth={size.border} />
            </Svg>
            <AppText variant="caption" tone="muted" style={[styles.corner, { right: space.s12, top: space.s8 }]} align="right">
              {QUADRANT_LABEL.star}
            </AppText>
            <AppText variant="caption" tone="muted" style={[styles.corner, { left: space.s12, top: space.s8 }]}>
              {QUADRANT_LABEL.puzzle}
            </AppText>
            <AppText variant="caption" tone="muted" style={[styles.corner, { right: space.s12, bottom: space.s8 }]} align="right">
              {QUADRANT_LABEL.plowhorse}
            </AppText>
            <AppText variant="caption" tone="muted" style={[styles.corner, { left: space.s12, bottom: space.s8 }]}>
              {QUADRANT_LABEL.dog}
            </AppText>
            {points.map(p => (
              <Pressable
                key={p.id}
                onPress={() => onPress(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}: ${QUADRANT_LABEL[p.quadrant]}`}
                style={[styles.dot, { left: x(p.popularity) - size.touch / 2, top: y(p.profit) - size.touch / 2 }]}>
                <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: p.quadrant === 'star' ? service.accent : service.accentDeep, borderWidth: size.focusBorder, borderColor: colors.surface }} />
              </Pressable>
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.axes}>
        <AppText variant="caption" tone="muted">
          Ordered less
        </AppText>
        <AppText variant="caption" tone="muted">
          Ordered more
        </AppText>
      </View>
    </View>
  );
};

export default QuadrantChart;
