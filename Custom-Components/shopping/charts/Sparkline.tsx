// Sparkline — a week at a glance (Today's recorded sales): one line in the
// accent over a flat soft fill. No axes; the number beside it carries it.

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../../theme';
import { areaPath, linePath, scalePoints, useChartWidth } from './chartShared';

export const Sparkline: React.FC<{ values: number[]; height?: number; accessibilityLabel: string }> = ({
  values,
  height,
  accessibilityLabel,
}) => {
  const { service, size, space } = useTheme();
  const h = height ?? size.chart.spark;
  const { width, onLayout } = useChartWidth();
  const pts = width && values.length ? scalePoints(values, width, h, space.s4) : [];
  const last = pts[pts.length - 1];
  return (
    <View onLayout={onLayout} style={{ height: h }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {width ? (
        <Svg width={width} height={h}>
          <Path d={areaPath(pts, h)} fill={service.accentSoft} />
          <Path d={linePath(pts)} stroke={service.accent} strokeWidth={size.focusBorder} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {last ? <Circle cx={last.x} cy={last.y} r={size.focusBorder * 2} fill={service.accent} /> : null}
        </Svg>
      ) : null}
    </View>
  );
};

export default Sparkline;
