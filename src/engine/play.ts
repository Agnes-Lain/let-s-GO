// Moves: legality, captures (提子 tízǐ), suicide (禁入点 jìnrùdiǎn) and simple ko (打劫 dǎjié).
// Spec: docs/specs/M1-rules-engine.md §4 C. Illegal moves are results, never exceptions (D7).

import { indexOf, neighbors, stoneAt, withStones } from './board';
import { comparePoints, isOnBoard, parseVertex } from './coordinates';
import { groupAt } from './groups';
import type {
  Board,
  Color,
  GameState,
  Group,
  IllegalReason,
  MoveFacts,
  PassResult,
  PlayResult,
  Point,
  Vertex,
} from './types';

export type CheckResult = { legal: true } | { legal: false; reason: IllegalReason };

/**
 * Plays a stone for `state.toPlay` at a point or vertex. Returns the new state and the move's
 * facts, or the reason the move is illegal. A malformed vertex string is a content error and
 * throws EngineError('invalid-vertex'); a Point outside the board returns 'off-board'.
 */
export function play(state: GameState, at: Point | Vertex): PlayResult {
  const point = resolvePoint(state, at);
  const check = checkPoint(state, point);
  if (!check.legal) return { ok: false, reason: check.reason };
  if (point === null) return { ok: false, reason: 'off-board' }; // narrows the type; checked above

  const { board, toPlay: color } = state;
  const opponent = other(color);
  const placed = withStones(board, [point], color);

  const captured = adjacentGroups(placed, point, opponent).filter((g) => g.liberties.length === 0);
  const capturedStones = captured.flatMap((g) => g.stones);
  const after = withStones(placed, capturedStones, null);

  const playedGroup = groupAt(after, point) as Group;
  const koPoint =
    capturedStones.length === 1 &&
    playedGroup.stones.length === 1 &&
    playedGroup.liberties.length === 1
      ? capturedStones[0]
      : null;

  const facts: MoveFacts = {
    color,
    point,
    captured: captured.map((g) => g.stones),
    playedGroup,
    opponentAtari: adjacentGroups(after, point, opponent).filter((g) => g.liberties.length === 1),
    selfAtari: playedGroup.liberties.length === 1,
    koPoint,
  };

  return {
    ok: true,
    facts,
    state: {
      board: after,
      toPlay: opponent,
      komi: state.komi,
      koPoint,
      captures: { ...state.captures, [color]: state.captures[color] + capturedStones.length },
      consecutivePasses: 0,
      isOver: false,
      moves: [...state.moves, { type: 'play', color, point }],
    },
  };
}

/** Whether `state.toPlay` may play here, and if not, why. Never plays the move. */
export function checkMove(state: GameState, at: Point | Vertex): CheckResult {
  return checkPoint(state, resolvePoint(state, at));
}

/** Every legal point for `state.toPlay` (pass excluded), sorted by column, then row. */
export function legalMoves(state: GameState): Point[] {
  const { size } = state.board;
  const moves: Point[] = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (checkPoint(state, { x, y }).legal) moves.push({ x, y });
    }
  }
  return moves;
}

/**
 * Minimal pass for PR 2: switches the turn, lifts the ko ban (a pass counts as the one turn,
 * decision D8), counts the pass and records it. Ending the game after two passes is M1 PR 3.
 */
export function pass(state: GameState): PassResult {
  if (state.isOver) return { ok: false, reason: 'game-over' };
  return {
    ok: true,
    state: {
      ...state,
      toPlay: other(state.toPlay),
      koPoint: null,
      consecutivePasses: state.consecutivePasses + 1,
      moves: [...state.moves, { type: 'pass', color: state.toPlay }],
    },
  };
}

/** Point notation is resolved here; null means a Point object that is not on the board. */
function resolvePoint(state: GameState, at: Point | Vertex): Point | null {
  if (typeof at === 'string') return parseVertex(at, state.board.size);
  return isOnBoard(at, state.board.size) ? { x: at.x, y: at.y } : null;
}

/**
 * The legality check without building a new board: a move is legal when the point is free,
 * not the ko point, and the new stone has a liberty — an empty neighbour, a friendly group
 * with another liberty, or an opponent group it captures (whose only liberty is this point).
 */
function checkPoint(state: GameState, point: Point | null): CheckResult {
  if (state.isOver) return { legal: false, reason: 'game-over' };
  if (point === null) return { legal: false, reason: 'off-board' };
  const { board, toPlay: color, koPoint } = state;
  if (stoneAt(board, point) !== null) return { legal: false, reason: 'occupied' };
  if (koPoint !== null && koPoint.x === point.x && koPoint.y === point.y) {
    return { legal: false, reason: 'ko' };
  }

  const around = neighbors(point, board.size);
  if (around.some((neighbor) => stoneAt(board, neighbor) === null)) return { legal: true };
  for (const neighbor of around) {
    const stone = stoneAt(board, neighbor);
    const libertyCount = (groupAt(board, neighbor) as Group).liberties.length;
    if (stone === color ? libertyCount > 1 : libertyCount === 1) return { legal: true };
  }
  return { legal: false, reason: 'suicide' };
}

/** Distinct groups of `color` touching `point`, sorted by their first stone. */
function adjacentGroups(board: Board, point: Point, color: Color): Group[] {
  const seen = new Set<number>();
  const groups: Group[] = [];
  for (const neighbor of neighbors(point, board.size)) {
    if (stoneAt(board, neighbor) !== color || seen.has(indexOf(neighbor, board.size))) continue;
    const group = groupAt(board, neighbor) as Group;
    for (const stone of group.stones) seen.add(indexOf(stone, board.size));
    groups.push(group);
  }
  return groups.sort((a, b) => comparePoints(a.stones[0], b.stones[0]));
}

function other(color: Color): Color {
  return color === 'B' ? 'W' : 'B';
}
