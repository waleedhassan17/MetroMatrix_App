// LineChart — recorded sales over the range (Insights): the line, a floor
// and a top rule with its value, dots only when there are few points.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useStyles, useTheme, type Theme } from '../../../theme';
import { AppText } from '../../AppText';
import { areaPath, describeSeries, linePath, scalePoints, useChartWidth, type ChartPoint } from './chartShared';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    top: { flexDirection: 'row', justifyContent: 'flex-end' },
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.s4 },
  });

export const LineChart: React.FC<{ data: ChartPoint[]; format?: (n: number) => string; height?: number }> = ({
  data,
  format = n => String(n),
  height,
}) => {
  const styles = useStyles(makeStyles);
  const { service, colors, size, space } = useTheme();
  const h = height ?? size.chart.line;
  const { width, onLayout } = useChartWidth();
  const values = data.map(d => d.value);
  const pts = width && data.length ? scalePoints(values, width, h, space.s8) : [];
  const max = Math.max(0, ...values);
  const ticks = data.length ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={describeSeries(data, format)}>
      <View style={styles.top}>
        <AppText variant="caption" tone="muted">
          {format(max)}
        </AppText>
      </View>
      <View onLayout={onLayout} style={{ height: h }}>
        {width ? (
          <Svg width={width} height={h}>
            <Line x1={0} x2={width} y1={space.s8} y2={space.s8} stroke={colors.lineSoft} strokeWidth={size.border} />
            <Line x1={0} x2={width} y1={h - space.s8} y2={h - space.s8} stroke={colors.line} strokeWidth={size.border} />
            <Path d={areaPath(pts, h - space.s8)} fill={service.accentSoft} />
            <Path d={linePath(pts)} stroke={service.accent} strokeWidth={size.focusBorder} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {pts.length <= 14 ? pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={size.focusBorder * 1.5} fill={service.accent} />) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.labels}>
        {ticks.map((t, i) => (
          <AppText key={`${t}-${i}`} variant="caption" tone="muted">
            {data[t]?.label}
          </AppText>
        ))}
      </View>
    </View>
  );
};

export default LineChart;
