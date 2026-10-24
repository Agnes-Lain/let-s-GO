// Spec docs/specs/M6b-13x13-game.md AC 18, 21, 23: the 13×13 board at 360×740 (328 px wide).
import { boardGeometry, pointFromLocation, pointToLocation } from './geometry';

describe('13×13 geometry at 328 px', () => {
  const g = boardGeometry(13, 328, true);

  it('AC 18, 23: cell ≈ 22.8 px with coordinates, stones ≥ 21 px', () => {
    expect(g.cell).toBeCloseTo(328 / 14.4, 5);
    expect(2 * g.stoneRadius).toBeGreaterThanOrEqual(21);
    expect(boardGeometry(13, 328, false).cell).toBeCloseTo(328 / 13.2, 5);
  });

  it('AC 21: every pixel inside the grid maps to the nearest intersection (no dead gaps)', () => {
    const far = g.origin + 12 * g.cell;
    for (let x = Math.ceil(g.origin); x <= far; x++) {
      for (let y = Math.ceil(g.origin); y <= far; y++) {
        const p = pointFromLocation(g, x, y);
        expect(p).not.toBeNull();
        if (!p) continue;
        const c = pointToLocation(g, p);
        expect(Math.abs(c.x - x)).toBeLessThanOrEqual(g.cell / 2 + 1e-9);
        expect(Math.abs(c.y - y)).toBeLessThanOrEqual(g.cell / 2 + 1e-9);
      }
    }
  });

  it('AC 21: a touch between two points rounds to the nearer one', () => {
    const a = pointToLocation(g, { x: 9, y: 9 });
    expect(pointFromLocation(g, a.x + 0.4 * g.cell, a.y)).toEqual({ x: 9, y: 9 });
    expect(pointFromLocation(g, a.x + 0.6 * g.cell, a.y)).toEqual({ x: 10, y: 9 });
  });
});
