// Fast move analysis for the bot (spec §6.2 "per candidate the bot reads MoveFacts"). Running the
// engine's play() and a full group scan for every legal move was too slow for 9×9 playouts
// (AC 16, 36), so the bot labels the groups of the position once and derives, per legal move, the
// same facts play() would report. analysis.test.ts checks every fact against play() on hundreds
// of positions. Legality still comes from the engine (legalMoves).
import type { Board, Color, Point } from '@/engine';

/** What one legal move would do (the facts the rules of thumb need). */
export interface MoveAnalysis {
  point: Point;
  /** Stones the move captures. */
  captured: number;
  /** Liberties of the group holding the new stone, after captures. */
  liberties: number;
  /** The new stone's group has exactly one liberty. */
  selfAtari: boolean;
  /** Sizes of the opponent groups touching the move that are left with exactly one liberty. */
  opponentAtari: number[];
  /** Distinct opponent groups touching the move (before it is played). */
  touched: number;
  /** Own stones in groups with exactly one liberty after the move. */
  exposed: number;
}

interface Groups {
  /** Group index per cell, -1 when empty. */
  id: Int32Array;
  color: Color[];
  size: number[];
  /** Liberty cells per group (no duplicates). */
  libs: number[][];
}

function neighbors(cell: number, size: number, count: number): number[] {
  const out: number[] = [];
  const x = cell % size;
  if (x > 0) out.push(cell - 1);
  if (x < size - 1) out.push(cell + 1);
  if (cell >= size) out.push(cell - size);
  if (cell < count - size) out.push(cell + size);
  return out;
}

function labelGroups(board: Board): Groups {
  const { size, cells } = board;
  const count = cells.length;
  const id = new Int32Array(count).fill(-1);
  const groups: Groups = { id, color: [], size: [], libs: [] };
  for (let start = 0; start < count; start++) {
    const color = cells[start];
    if (color === null || id[start] !== -1) continue;
    const g = groups.color.length;
    const libSet = new Set<number>();
    const stack = [start];
    id[start] = g;
    let stones = 0;
    while (stack.length > 0) {
      const cell = stack.pop() as number;
      stones++;
      for (const n of neighbors(cell, size, count)) {
        const stone = cells[n];
        if (stone === null) libSet.add(n);
        else if (stone === color && id[n] === -1) {
          id[n] = g;
          stack.push(n);
        }
      }
    }
    groups.color.push(color);
    groups.size.push(stones);
    groups.libs.push([...libSet]);
  }
  return groups;
}

/** Facts for each point (all must be legal for `color`), in the same order. */
export function analyzeMoves(board: Board, color: Color, points: readonly Point[]): MoveAnalysis[] {
  const { size, cells } = board;
  const count = cells.length;
  const groups = labelGroups(board);
  const own: number[] = [];
  groups.color.forEach((c, g) => {
    if (c === color) own.push(g);
  });

  return points.map((point) => {
    const p = point.y * size + point.x;
    const around = neighbors(p, size, count);
    const merged = new Set<number>();
    const opponents = new Set<number>();
    const emptyAround: number[] = [];
    for (const n of around) {
      const g = groups.id[n];
      if (g === -1) emptyAround.push(n);
      else if (groups.color[g] === color) merged.add(g);
      else opponents.add(g);
    }

    // Opponent groups whose only liberty is p are captured; the others lose liberty p.
    const capturedGroups = [...opponents].filter((g) => groups.libs[g].length === 1);
    const captured = capturedGroups.reduce((n, g) => n + groups.size[g], 0);
    const opponentAtari = [...opponents]
      .filter((g) => groups.libs[g].length === 2)
      .map((g) => groups.size[g]);

    // Own groups next to a captured stone gain a liberty.
    const freed = new Set<number>();
    const gaining = new Set<number>();
    if (capturedGroups.length > 0) {
      const capturedSet = new Set(capturedGroups);
      for (let cell = 0; cell < count; cell++) {
        if (!capturedSet.has(groups.id[cell])) continue;
        for (const n of neighbors(cell, size, count)) {
          const g = groups.id[n];
          if (n === p || (g !== -1 && merged.has(g))) freed.add(cell);
          else if (g !== -1 && groups.color[g] === color) gaining.add(g);
        }
      }
    }

    const libSet = new Set<number>(emptyAround);
    for (const g of merged) for (const l of groups.libs[g]) libSet.add(l);
    libSet.delete(p);
    for (const cell of freed) libSet.add(cell);
    const liberties = libSet.size;
    const selfAtari = liberties === 1;

    let exposed = 0;
    for (const g of own) {
      if (merged.has(g) || gaining.has(g)) continue;
      if (groups.libs[g].length === 1) exposed += groups.size[g];
    }
    if (selfAtari) exposed += 1 + [...merged].reduce((n, g) => n + groups.size[g], 0);

    return {
      point,
      captured,
      liberties,
      selfAtari,
      opponentAtari,
      touched: opponents.size,
      exposed,
    };
  });
}

/** Own stones in groups with exactly one liberty (stones in atari) before any move. */
export function exposedStones(board: Board, color: Color): number {
  const groups = labelGroups(board);
  let exposed = 0;
  groups.color.forEach((c, g) => {
    if (c === color && groups.libs[g].length === 1) exposed += groups.size[g];
  });
  return exposed;
}
