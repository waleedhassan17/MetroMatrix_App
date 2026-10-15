// BarChart — orders per day (Insights). Bars in the soft accent, the best
// day in the full accent with its value; a few day labels underneath.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useStyles, useTheme, type Theme } from '../../../theme';
import { AppText } from '../../AppText';
import { describeSeries, useChartWidth, type ChartPoint } from './chartShared';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.s4 },
  });

export const BarChart: React.FC<{ data: ChartPoint[]; format?: (n: number) => string; height?: number }> = ({
  data,
  format = n => String(n),
  height,
}) => {
  const styles = useStyles(makeStyles);
  const { service, size, radius, space } = useTheme();
  const h = height ?? size.chart.bar;
  const { width, onLayout } = useChartWidth();
  const max = Math.max(1, ...data.map(d => d.value));
  const gap = data.length > 31 ? 1 : space.s4;
  const barW = data.length ? Math.max(1, (width - gap * (data.length - 1)) / data.length) : 0;
  const best = data.reduce((a, d, i) => (d.value > (data[a]?.value ?? -1) ? i : a), 0);
  const ticks = data.length ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={describeSeries(data, format)}>
      <View onLayout={onLayout} style={{ height: h }}>
        {width ? (
          <Svg width={width} height={h}>
            {data.map((d, i) => {
              const bh = d.value > 0 ? Math.max(space.s4, (d.value / max) * (h - space.s4)) : size.focusBorder;
              return (
                <Rect
                  key={`${d.label}-${i}`}
                  x={i * (barW + gap)}
                  y={h - bh}
                  width={barW}
                  height={bh}
                  rx={Math.min(radius.sm / 2, barW / 2)}
                  fill={i === best && d.value > 0 ? service.accent : service.accentLine}
                />
              );
            })}
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

export default BarChart;
