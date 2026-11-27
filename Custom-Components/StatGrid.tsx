// ═══════════════════════════════════════════════════════
// StatGrid — numbers in columns (the console's, the store's, the kitchen's)
// ═══════════════════════════════════════════════════════
// Each tile is a white card: a plain slate glyph and the label (one line),
// the number in the one stat role, and an optional hint (one line). No
// tinted wells and no colour (the owner, 2026-11-27). Every tile keeps its
// column's width, so an odd last tile never stretches across the row, and
// when any tile has a hint every tile keeps that line, so a grid's tiles are
// one height. StatGridSkeleton is built from the same measures.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';

/** Holds an empty line's height: a plain space collapses to nothing in a browser. */
const NBSP = '\u00A0';
import { AppText } from './AppText';
import { Card } from './Card';
import { IonIcon, type IonName } from './Icon';
import { Skeleton } from './Skeleton';

export interface AdminStat {
  key: string;
  icon: IonName;
  /** null while loading. */
  value: string | number | null;
  label: string;
  /** A line under the number ("of 12 placed"). */
  hint?: string | null;
  onPress?: () => void;
}

const makeStyles = ({ colors, space, radius, elevation }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: {
      gap: space.s4,
      padding: space.s16,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    compact: { padding: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
    line: { justifyContent: 'center' },
  });

/** Columns of equal width from the grid's measured width. */
const useColumns = (columns: number) => {
  const { space } = useTheme();
  const [width, setWidth] = useState(0);
  const tile = width ? Math.floor((width - space.s12 * (columns - 1)) / columns) : undefined;
  return { tile, onLayout: (w: number) => setWidth(w) };
};

const StatTile: React.FC<{ stat: AdminStat; compact?: boolean; width?: number; hintLine: boolean }> = ({
  stat: s,
  compact,
  width,
  hintLine,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, type } = useTheme();
  const frame = [styles.tile, compact && styles.compact, width ? { width } : styles.grow];
  const body = (
    <>
      <View style={styles.head}>
        <IonIcon name={s.icon} size="sm" color={colors.inkMuted} />
        {compact ? null : (
          <AppText variant="small" tone="muted" numberOfLines={1} style={styles.grow}>
            {s.label}
          </AppText>
        )}
      </View>
      {s.value === null ? (
        <View style={[styles.line, { height: type.stat.lineHeight as number }]}>
          <Skeleton width="50%" height={Math.round((type.stat.lineHeight as number) * 0.7)} />
        </View>
      ) : (
        // One line: a value is a number or a short word; the words that explain it go in the hint.
        <AppText variant="stat" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {String(s.value)}
        </AppText>
      )}
      {compact ? (
        // Two lines in a narrow column ("Payments to check"); a row's tiles stretch to match.
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {s.label}
        </AppText>
      ) : null}
      {hintLine ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {s.hint || NBSP}
        </AppText>
      ) : null}
    </>
  );
  const label = `${s.label}: ${s.value ?? 'loading'}${s.hint ? `, ${s.hint}` : ''}`;
  return s.onPress ? (
    <Card onPress={s.onPress} padded={false} style={frame} accessibilityLabel={label}>
      {body}
    </Card>
  ) : (
    <View style={frame} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
};

/**
 * Numbers in columns (two by default). `compact`: the store's Today tiles,
 * three to a row (the glyph, the number, the label under it).
 */
export const StatGrid: React.FC<{ stats: AdminStat[]; columns?: 2 | 3; compact?: boolean }> = ({ stats, columns = 2, compact }) => {
  const styles = useStyles(makeStyles);
  const { tile, onLayout } = useColumns(columns);
  const hintLine = stats.some(s => !!s.hint);
  return (
    <View style={styles.grid} onLayout={e => onLayout(e.nativeEvent.layout.width)}>
      {stats.map(s => (
        <StatTile key={s.key} stat={s} compact={compact} width={tile} hintLine={hintLine} />
      ))}
    </View>
  );
};

/** The grid while it loads, tile for tile: the same columns, frame and lines. */
export const StatGridSkeleton: React.FC<{ count?: number; columns?: 2 | 3; compact?: boolean; hints?: boolean }> = ({
  count,
  columns,
  compact,
  hints = false,
}) => {
  const styles = useStyles(makeStyles);
  const { type, size } = useTheme();
  const cols = columns ?? (compact ? 3 : 2);
  const { tile, onLayout } = useColumns(cols);
  const n = count ?? cols * 2;
  const bar = (role: 'small' | 'stat' | 'caption', width: `${number}%`) => (
    <View style={[styles.line, { height: type[role].lineHeight as number }]}>
      <Skeleton width={width} height={Math.round((type[role].lineHeight as number) * 0.6)} />
    </View>
  );
  return (
    <View
      style={styles.grid}
      onLayout={e => onLayout(e.nativeEvent.layout.width)}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[styles.tile, compact && styles.compact, tile ? { width: tile } : styles.grow]}>
          <View style={[styles.head, { height: compact ? size.icon.sm : Math.max(size.icon.sm, type.small.lineHeight as number) }]}>
            {compact ? <Skeleton width={size.icon.sm} height={size.icon.sm} shape="pill" /> : bar('small', '60%')}
          </View>
          {bar('stat', '45%')}
          {compact ? bar('caption', '70%') : null}
          {hints ? bar('caption', '50%') : null}
        </View>
      ))}
    </View>
  );
};

export default StatGrid;
