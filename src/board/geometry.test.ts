import { EngineError, type BoardSize } from '@/engine';

import {
  boardGeometry,
  columnLabels,
  pointFromLocation,
  pointToLocation,
  rowLabels,
  starPoints,
  stonesFromSetup,
  vertexLabel,
} from './geometry';

describe('columnLabels / rowLabels (AC1, AC2)', () => {
  it('skips the letter I', () => {
    expect(columnLabels(5)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(columnLabels(9)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J']);
    expect(columnLabels(13)).toEqual('ABCDEFGHJKLMN'.split(''));
    expect(columnLabels(19)).toEqual('ABCDEFGHJKLMNOPQRST'.split(''));
    for (const s of [5, 7, 9, 13, 19] as BoardSize[]) expect(columnLabels(s)).not.toContain('I');
  });

  it('numbers rows top to bottom', () => {
    expect(rowLabels(9)).toEqual(['9', '8', '7', '6', '5', '4', '3', '2', '1']);
    expect(rowLabels(19)[0]).toBe('19');
  });
});

describe('starPoints (AC3)', () => {
  it('returns the star points sorted by column then row', () => {
    expect(starPoints(5)).toEqual(['c3']);
    expect(starPoints(7)).toEqual(['d4']);
    expect(starPoints(9)).toEqual(['c3', 'c7', 'e5', 'g3', 'g7']);
    expect(starPoints(13)).toEqual(['d4', 'd10', 'g7', 'k4', 'k10']);
    expect(starPoints(19)).toEqual(['d4', 'd10', 'd16', 'k4', 'k10', 'k16', 'q4', 'q10', 'q16']);
  });
});

describe('boardGeometry (AC4, AC5)', () => {
  const table: [BoardSize, boolean, number, number][] = [
    [5, true, 54.67, 54.67],
    [5, false, 63.08, 37.85],
    [7, true, 41.0, 41.0],
    [7, false, 45.56, 27.33],
    [9, true, 32.8, 32.8],
    [9, false, 35.65, 21.39],
    [13, true, 22.78, 27.33],
    [13, false, 24.85, 14.91],
    [19, true, 16.08, 19.29],
    [19, false, 17.08, 10.25],
  ];
  it.each(table)('size %i coords %s -> cell %f origin %f', (size, coords, cell, origin) => {
    const g = boardGeometry(size, 328, coords);
    expect(g.cell).toBeCloseTo(cell, 2);
    expect(g.origin).toBeCloseTo(origin, 2);
    expect(g.stoneRadius).toBeCloseTo(0.47 * g.cell, 2);
    expect(g.width).toBe(328);
    expect(g.size).toBe(size);
  });

  it('stone radius for 9x9 with coordinates is 15.42', () => {
    expect(boardGeometry(9, 328, true).stoneRadius).toBeCloseTo(15.42, 2);
  });

  it('clamps star, last-move and label sizes', () => {
    const g9 = boardGeometry(9, 328, true);
    expect(g9.starRadius).toBeCloseTo(2.95, 2);
    expect(g9.lastMoveRadius).toBeCloseTo(5.25, 2);
    expect(g9.labelFontSize).toBeCloseTo(11.81, 2);
    const g5 = boardGeometry(5, 328, true);
    expect([g5.starRadius, g5.lastMoveRadius, g5.labelFontSize]).toEqual([4, 6, 13]);
    const g19 = boardGeometry(19, 328, true);
    expect([g19.starRadius, g19.lastMoveRadius, g19.labelFontSize]).toEqual([2.5, 3, 10]);
  });
});

describe('coordinate labels stay clear of edge stones (AC4a)', () => {
  it.each([5, 7, 9, 13, 19] as BoardSize[])('size %i', (size) => {
    const g = boardGeometry(size, 328, true);
    // Label centre is g.labelOffset from the outer line; an edge stone reaches stoneRadius.
    expect(g.labelOffset).toBeGreaterThan(g.stoneRadius + g.labelFontSize / 2);
    // ...and the label still lies fully inside the board (margin = origin).
    expect(g.labelOffset + g.labelFontSize / 2).toBeLessThan(g.origin);
  });
});

describe('pointFromLocation / pointToLocation (AC6)', () => {
  const g = boardGeometry(9, 328, true);

  it('maps pixels to the nearest intersection', () => {
    expect(pointFromLocation(g, 32.8, 32.8)).toEqual({ x: 0, y: 8 });
    expect(pointFromLocation(g, 295.2, 295.2)).toEqual({ x: 8, y: 0 });
    expect(pointFromLocation(g, 164, 164)).toEqual({ x: 4, y: 4 });
    expect(pointFromLocation(g, 182, 182)).toEqual({ x: 5, y: 3 });
    expect(pointFromLocation(g, 20, 164)).toEqual({ x: 0, y: 4 });
  });

  it('returns null off the board', () => {
    expect(pointFromLocation(g, 10, 164)).toBeNull();
    expect(pointFromLocation(g, 164, 320)).toBeNull();
    expect(pointFromLocation(g, -5, 100)).toBeNull();
  });

  it('treats exactly half a cell beyond the outer lines as on the board, on all four sides', () => {
    const half = g.cell / 2;
    const near = g.origin;
    const far = g.origin + 8 * g.cell;
    expect(pointFromLocation(g, near - half, 164)).toEqual({ x: 0, y: 4 });
    expect(pointFromLocation(g, far + half, 164)).toEqual({ x: 8, y: 4 });
    expect(pointFromLocation(g, 164, near - half)).toEqual({ x: 4, y: 8 });
    expect(pointFromLocation(g, 164, far + half)).toEqual({ x: 4, y: 0 });
  });

  it('hides the preview just past half a cell on all four sides', () => {
    const eps = 0.01;
    const half = g.cell / 2;
    const near = g.origin;
    const far = g.origin + 8 * g.cell;
    expect(pointFromLocation(g, near - half - eps, 164)).toBeNull();
    expect(pointFromLocation(g, far + half + eps, 164)).toBeNull();
    expect(pointFromLocation(g, 164, near - half - eps)).toBeNull();
    expect(pointFromLocation(g, 164, far + half + eps)).toBeNull();
  });

  it('maps a point to the pixel centre of its intersection', () => {
    const loc = pointToLocation(g, { x: 4, y: 4 });
    expect(loc.x).toBeCloseTo(164, 2);
    expect(loc.y).toBeCloseTo(164, 2);
  });
});

describe('vertexLabel (AC7)', () => {
  it('uppercases the engine vertex', () => {
    expect(vertexLabel({ x: 3, y: 3 }, 9)).toBe('D4');
    expect(vertexLabel({ x: 8, y: 8 }, 9)).toBe('J9');
    expect(vertexLabel({ x: 18, y: 18 }, 19)).toBe('T19');
  });
});

describe('stonesFromSetup (AC8)', () => {
  it('builds a row-major array', () => {
    const cells = stonesFromSetup(5, { B: ['c3'], W: ['c4'] });
    expect(cells).toHaveLength(25);
    expect(cells[12]).toBe('B');
    expect(cells[17]).toBe('W');
    expect(cells.filter((c) => c === null)).toHaveLength(23);
  });

  it('throws invalid-vertex for a bad vertex', () => {
    expect(() => stonesFromSetup(5, { B: ['z9'] })).toThrow(EngineError);
    try {
      stonesFromSetup(5, { W: ['f1'] });
    } catch (e) {
      expect((e as EngineError).code).toBe('invalid-vertex');
    }
  });
});
