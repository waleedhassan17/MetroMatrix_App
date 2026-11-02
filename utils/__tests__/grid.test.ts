import { gridCellWidth } from '../grid/grid';

describe('gridCellWidth', () => {
  it('fills the row exactly, gaps included', () => {
    // 360 pt phone, 20 gutters: 320 wide, three columns, 12 between.
    expect(gridCellWidth(320, 3, 12)).toBe(98);
    expect(gridCellWidth(320, 3, 12) * 3 + 12 * 2).toBeLessThanOrEqual(320);
    expect(gridCellWidth(350, 2, 12)).toBe(169);
  });

  it('answers 0 before the grid has a width', () => {
    expect(gridCellWidth(0, 3, 12)).toBe(0);
    expect(gridCellWidth(320, 0, 12)).toBe(0);
  });
});
