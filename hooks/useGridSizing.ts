// ═══════════════════════════════════════════════════════
// useGridSizing — a wrapping grid's cell width, from its own width
// ═══════════════════════════════════════════════════════
// Lay the grid out with `onLayout`; until it has measured, the window's width
// less the gutters stands in, so the first frame is already close.

import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../theme';
import { gridCellWidth } from '../utils/grid/grid';

export const useGridSizing = (columns: number, gap?: number) => {
  const { gutter, space } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const g = gap ?? space.s12;
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const cellWidth = gridCellWidth(width || windowWidth - gutter * 2, columns, g);
  return { cellWidth, gap: g, onLayout };
};
