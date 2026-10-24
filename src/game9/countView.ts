// What the count screen draws (spec docs/specs/M6-bot-levels.md AC 30, §5.4): the board with the
// dead stones removed and the territory points of each side. Numbers come from ScoreResult only.
import {
  parseVertex,
  type BoardSize,
  type Color,
  type Point,
  type ScoreResult,
  type Vertex,
} from '@/engine';

/** The board size of a row-major cell list (81 → 9, 169 → 13). */
function sizeOf(cells: readonly unknown[]): BoardSize {
  return Math.round(Math.sqrt(cells.length)) as BoardSize;
}

/** The board cells with the dead stones taken off. */
export function countStones(
  cells: readonly (Color | null)[],
  dead: readonly Vertex[],
): (Color | null)[] {
  const size = sizeOf(cells);
  const out = [...cells];
  for (const v of dead) {
    const p = parseVertex(v, size);
    out[p.y * size + p.x] = null;
  }
  return out;
}

/** Empty points (after removing the dead stones) owned by each side. */
export function territoryPoints(
  score: ScoreResult,
  cells: readonly (Color | null)[],
  dead: readonly Vertex[],
): { B: Point[]; W: Point[] } {
  const size = sizeOf(cells);
  const alive = countStones(cells, dead);
  const out: { B: Point[]; W: Point[] } = { B: [], W: [] };
  score.ownership.forEach((owner, i) => {
    if (owner !== null && alive[i] === null) {
      out[owner].push({ x: i % size, y: Math.floor(i / size) });
    }
  });
  return out;
}
