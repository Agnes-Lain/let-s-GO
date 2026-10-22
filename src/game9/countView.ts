// What the count screen draws (spec docs/specs/M6-bot-levels.md AC 30, §5.4): the board with the
// dead stones removed and the territory points of each side. Numbers come from ScoreResult only.
import { parseVertex, type Color, type Point, type ScoreResult, type Vertex } from '@/engine';

/** The board cells with the dead stones taken off. */
export function countStones(
  cells: readonly (Color | null)[],
  dead: readonly Vertex[],
): (Color | null)[] {
  const out = [...cells];
  for (const v of dead) {
    const p = parseVertex(v, 9);
    out[p.y * 9 + p.x] = null;
  }
  return out;
}

/** Empty points (after removing the dead stones) owned by each side. */
export function territoryPoints(
  score: ScoreResult,
  cells: readonly (Color | null)[],
  dead: readonly Vertex[],
): { B: Point[]; W: Point[] } {
  const alive = countStones(cells, dead);
  const out: { B: Point[]; W: Point[] } = { B: [], W: [] };
  score.ownership.forEach((owner, i) => {
    if (owner !== null && alive[i] === null) out[owner].push({ x: i % 9, y: Math.floor(i / 9) });
  });
  return out;
}
