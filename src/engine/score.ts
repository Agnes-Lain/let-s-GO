// Chinese area scoring (数子法 shùzǐfǎ): each side's stones on the board plus the empty points
// surrounded only by that side; komi (贴目 tiēmù) goes to white. Prisoners do not count.
// Spec: docs/specs/M1-rules-engine.md §4 D (AC 28–31), decisions D6 and D9.

import { indexOf, neighbors, pointOf, stoneAt, withStones } from './board';
import { comparePoints, toPoint } from './coordinates';
import { isValidKomi } from './game';
import { groupAt } from './groups';
import { EngineError } from './types';
import type { Board, Color, Point, ScoreResult, ScoreSide, Vertex } from './types';

export interface ScoreOptions {
  /** Added to white's total. Must be a finite multiple of 0.5. */
  komi: number;
  /** Stones agreed to be dead. Marking one stone marks its whole group (D6). */
  deadStones?: readonly (Point | Vertex)[];
}

/**
 * Scores any position (not only finished games). Dead stones are removed first and their
 * points then count like any other empty point. An empty region that touches only one color
 * is that color's territory; a region touching both colors, or no stone at all, is dame.
 * Throws EngineError: 'invalid-dead-stone' (empty or off-board point), 'invalid-komi'.
 */
export function score(board: Board, opts: ScoreOptions): ScoreResult {
  const { komi } = opts;
  if (!isValidKomi(komi)) {
    throw new EngineError('invalid-komi', `Komi must be a multiple of 0.5, got ${komi}`);
  }

  const deadStones = expandDeadStones(board, opts.deadStones ?? []);
  const alive = withStones(board, deadStones, null);
  const ownership = ownershipOf(alive);

  const black = side(alive, ownership, 'B', 0);
  const white = side(alive, ownership, 'W', komi);
  const dame = alive.cells
    .map((stone, index) => (stone === null && ownership[index] === null ? index : -1))
    .filter((index) => index >= 0)
    .map((index) => pointOf(index, board.size))
    .sort(comparePoints);

  const difference = black.total - white.total;
  const winner: Color | null = difference > 0 ? 'B' : difference < 0 ? 'W' : null;
  const margin = Math.abs(difference);

  return {
    black,
    white,
    dame,
    deadStones,
    ownership,
    winner,
    margin,
    result: winner === null ? 'Draw' : `${winner}+${margin}`,
  };
}

/** Every stone of every marked group, without duplicates, sorted by column then row. */
function expandDeadStones(board: Board, marked: readonly (Point | Vertex)[]): Point[] {
  const indexes = new Set<number>();
  for (const at of marked) {
    const point = deadStonePoint(board, at);
    if (indexes.has(indexOf(point, board.size))) continue;
    const group = groupAt(board, point);
    if (group === null) {
      throw new EngineError('invalid-dead-stone', `No stone to mark dead at ${describe(at)}`);
    }
    for (const stone of group.stones) indexes.add(indexOf(stone, board.size));
  }
  return [...indexes].map((index) => pointOf(index, board.size)).sort(comparePoints);
}

function deadStonePoint(board: Board, at: Point | Vertex): Point {
  try {
    return toPoint(at, board.size);
  } catch {
    throw new EngineError('invalid-dead-stone', `Dead stone ${describe(at)} is not on the board`);
  }
}

/** Owner of each point: the stone on it, or the only color around its empty region. */
function ownershipOf(board: Board): (Color | null)[] {
  const ownership: (Color | null)[] = [...board.cells];
  const visited = new Set<number>();

  board.cells.forEach((stone, start) => {
    if (stone !== null || visited.has(start)) return;
    const region: number[] = [start];
    const borders = new Set<Color>();
    visited.add(start);
    for (let i = 0; i < region.length; i++) {
      for (const neighbor of neighbors(pointOf(region[i], board.size), board.size)) {
        const index = indexOf(neighbor, board.size);
        const neighborStone = stoneAt(board, neighbor);
        if (neighborStone !== null) {
          borders.add(neighborStone);
        } else if (!visited.has(index)) {
          visited.add(index);
          region.push(index);
        }
      }
    }
    const owner = borders.size === 1 ? [...borders][0] : null;
    for (const index of region) ownership[index] = owner;
  });
  return ownership;
}

function side(
  board: Board,
  ownership: readonly (Color | null)[],
  color: Color,
  komi: number,
): ScoreSide {
  let stones = 0;
  let territory = 0;
  board.cells.forEach((stone, index) => {
    if (stone === color) stones++;
    else if (stone === null && ownership[index] === color) territory++;
  });
  return { stones, territory, komi, total: stones + territory + komi };
}

function describe(at: Point | Vertex): string {
  return typeof at === 'string' ? `"${at}"` : JSON.stringify(at);
}
