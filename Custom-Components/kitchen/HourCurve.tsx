// HourCurve — a day in 24 hours: the area's demand as a soft area, the
// kitchen's own orders as a line over it. Screen readers get the peak hours.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { areaPath, linePath, useChartWidth } from '../shopping/charts/chartShared';

const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

const peakOf = (xs: number[]) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    legend: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
    key: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  });

/** `own` is the kitchen's line; without it (the staff's city map) only the area shows. */
export const HourCurve: React.FC<{ area: number[]; own?: number[]; areaLabel?: string; ownLabel?: string }> = ({ area, own, areaLabel = 'People searching nearby', ownLabel = 'Your orders' }) => {
  const styles = useStyles(makeStyles);
  const { size, service, space, radius } = useTheme();
  const { width, onLayout } = useChartWidth();
  const h = size.hourCurve;
  const pad = space.s4;
  const scale = (xs: number[]) => {
    const max = Math.max(1, ...xs);
    const step = (width - pad * 2) / 23;
    return xs.map((v, i) => ({ x: pad + step * i, y: h - pad - (v / max) * (h - pad * 2) }));
  };
  const a = width ? scale(area) : [];
  const o = width && own ? scale(own) : [];
  const label = own
    ? `${areaLabel} peaks at ${hourLabel(peakOf(area))}; ${ownLabel.toLowerCase()} peak at ${hourLabel(peakOf(own))}.`
    : `${areaLabel} peaks at ${hourLabel(peakOf(area))}.`;
  return (
    <View style={styles.root}>
      <View onLayout={onLayout} style={{ height: h }} accessible accessibilityRole="image" accessibilityLabel={label}>
        {width ? (
          <Svg width={width} height={h}>
            <Path d={areaPath(a, h)} fill={service.accentSoft} />
            {own ? <Path d={linePath(o)} stroke={service.accentDeep} strokeWidth={size.focusBorder} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        {[0, 6, 12, 18, 23].map(hh => (
          <AppText key={hh} variant="caption" tone="muted">
            {hourLabel(hh)}
          </AppText>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={{ width: space.s12, height: space.s12, borderRadius: radius.sm, backgroundColor: service.accentSoft }} />
          <AppText variant="caption" tone="muted">
            {areaLabel}
          </AppText>
        </View>
        {own ? (
          <View style={styles.key}>
            <View style={{ width: space.s12, height: size.focusBorder, backgroundColor: service.accentDeep }} />
            <AppText variant="caption" tone="muted">
              {ownLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default HourCurve;
