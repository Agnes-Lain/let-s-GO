import { emptyBoard, indexOf, withStones } from './board';
import { comparePoints, isBoardSize, parseVertex, toVertex } from './coordinates';
import { groupAt } from './groups';
import {
  EngineError,
  type Board,
  type BoardSize,
  type GameOptions,
  type GameState,
  type Point,
  type Vertex,
} from './types';

/**
 * Default komi (贴目 tiēmù) under Chinese rules. On 5×5 and 7×7 it is only a tie-breaker:
 * those boards are for exercises (spec decision D2).
 */
export function defaultKomi(size: BoardSize): number {
  return size === 5 || size === 7 ? 0.5 : 7.5;
}

/**
 * A new game. Throws EngineError: 'invalid-size' (not 5/7/9/13/19), 'invalid-komi'
 * (not a finite multiple of 0.5) or 'invalid-setup' (bad vertex, a point listed twice,
 * a group without liberties, unknown toPlay).
 */
export function createGame(size: number, opts: GameOptions = {}): GameState {
  if (!isBoardSize(size)) {
    throw new EngineError('invalid-size', `Board size must be 5, 7, 9, 13 or 19, got ${size}`);
  }

  const komi = opts.komi ?? defaultKomi(size);
  if (!Number.isFinite(komi) || !Number.isInteger(komi * 2)) {
    throw new EngineError('invalid-komi', `Komi must be a multiple of 0.5, got ${komi}`);
  }

  const toPlay = opts.toPlay ?? 'B';
  if (toPlay !== 'B' && toPlay !== 'W') {
    throw new EngineError('invalid-setup', `toPlay must be "B" or "W", got ${String(toPlay)}`);
  }

  return {
    board: setupBoard(size, opts.setup ?? {}),
    toPlay,
    komi,
    koPoint: null,
    captures: { B: 0, W: 0 },
    consecutivePasses: 0,
    isOver: false,
    moves: [],
  };
}

function setupBoard(size: BoardSize, setup: NonNullable<GameOptions['setup']>): Board {
  const black = setupPoints(setup.B ?? [], size);
  const white = setupPoints(setup.W ?? [], size);

  const seen = new Set<number>();
  for (const point of [...black, ...white]) {
    const index = indexOf(point, size);
    if (seen.has(index)) {
      throw new EngineError('invalid-setup', `Setup lists ${toVertex(point, size)} more than once`);
    }
    seen.add(index);
  }

  const board = withStones(withStones(emptyBoard(size), black, 'B'), white, 'W');

  for (const point of [...black, ...white].sort(comparePoints)) {
    const group = groupAt(board, point);
    if (group && group.liberties.length === 0) {
      throw new EngineError(
        'invalid-setup',
        `Setup group at ${toVertex(point, size)} has no liberties`,
      );
    }
  }
  return board;
}

function setupPoints(vertices: Vertex[], size: BoardSize): Point[] {
  return vertices.map((vertex) => {
    try {
      return parseVertex(vertex, size);
    } catch {
      throw new EngineError('invalid-setup', `Setup vertex "${vertex}" is not on the board`);
    }
  });
}
