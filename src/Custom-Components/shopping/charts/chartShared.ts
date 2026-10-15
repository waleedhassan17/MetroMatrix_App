// Shared by the charts: measure the width they draw into, and scale values.

import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export interface ChartPoint {
  label: string;
  value: number;
}

export const useChartWidth = () => {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  return { width, onLayout };
};

/** x/y for each value inside [pad, w - pad] × [pad, h - pad]; a flat series sits on the floor. */
export const scalePoints = (values: number[], w: number, h: number, pad: number) => {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: pad + step * i,
    y: h - pad - ((v - min) / span) * (h - pad * 2),
  }));
};

export const linePath = (pts: { x: number; y: number }[]) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** A line's path closed down to the floor (the soft area under it). */
export const areaPath = (pts: { x: number; y: number }[], h: number) =>
  pts.length ? `${linePath(pts)} L${pts[pts.length - 1].x.toFixed(1)},${h} L${pts[0].x.toFixed(1)},${h} Z` : '';

/** "Highest 4,500 on 12 Oct" — what a chart says to a screen reader. */
export const describeSeries = (data: ChartPoint[], format: (n: number) => string) => {
  if (!data.length) return 'No data';
  const top = data.reduce((a, b) => (b.value > a.value ? b : a));
  const total = data.reduce((s, d) => s + d.value, 0);
  return `${data.length} days, total ${format(total)}. Highest ${format(top.value)} on ${top.label}.`;
};
