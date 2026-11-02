// MetroMatrix — Grid cells that fill their row.
// A wrapping row of fixed-width tiles leaves a ragged right edge (four 76 pt
// tiles don't fit a 360 pt phone, so the last row hangs); this works out the
// cell width that fits `columns` exactly, gaps included.

/** The width of one cell when `columns` of them and their gaps fill `width`. */
export const gridCellWidth = (width: number, columns: number, gap: number): number => {
  if (width <= 0 || columns < 1) return 0;
  return Math.floor((width - gap * (columns - 1)) / columns);
};
