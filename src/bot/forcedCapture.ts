// Forced capture search (spec docs/specs/M5-sequence-v2.md §3.2–3.5): can the attacker capture
// the group holding `target` within `maxMoves` attacker moves, against every defence? Pure TS on
// top of the engine: no React, no timers, no randomness. Same input, same output.
//
// Defence (`opponent: "run"`): after each attacker move the defender may play any legal liberty
// of the target group, or capture an attacker group that touches it (capture to escape). With no
// such move the defender passes. Inside the proof the attacker plays only liberties of the group.
// Not modelled: defender tenuki for a bigger threat elsewhere, snapback tricks beyond capturing.
import {
  groupAt,
  legalMoves,
  pass,
  play,
  parseVertex,
  type Board,
  type BoardSize,
  type Color,
  type GameState,
  type IllegalReason,
  type MoveFacts,
  type Point,
  type Vertex,
} from '@/engine';

/** Hard cap on engine move applications per search (§3.5). */
export const FORCED_CAPTURE_MAX_NODES = 3000;

export interface CaptureProblem {
  attacker: Color;
  /** A stone of the defender; the target is the group holding it. */
  target: Point | Vertex;
  /** Attacker moves allowed, counting the move being judged. */
  maxMoves: number;
  /** Default FORCED_CAPTURE_MAX_NODES. Hitting it counts as "not forced". */
  maxNodes?: number;
}

export interface CaptureSearch {
  /** The attacker captures within `maxMoves` against every defence. */
  forced: boolean;
  /** Fewest attacker moves that are enough (null when not forced). */
  moves: number | null;
  /** The node cap was hit (then `forced` is false). */
  capped: boolean;
  /** Engine move applications used. */
  nodes: number;
}

/** What the defender answers to an attacker move (the reply the runner shows). */
export type AttackReply =
  | { kind: 'none' }
  | { kind: 'pass'; state: GameState }
  | { kind: 'play'; point: Point; state: GameState; facts: MoveFacts };

export type AttackJudgement =
  | { ok: false; reason: IllegalReason }
  | (CaptureSearch & {
      ok: true;
      /** The position after the attacker move. */
      state: GameState;
      facts: MoveFacts;
      /** The move captured the target. */
      captured: boolean;
      /** `none` when the target was captured. */
      reply: AttackReply;
    });

export interface WinningMoves {
  /** Winning moves: fewest moves to capture first, then lowest column, then lowest row. */
  moves: { point: Point; moves: number }[];
  capped: boolean;
  nodes: number;
}

const LOST = Number.POSITIVE_INFINITY;

class Capped extends Error {}

/** Compares move counts where LOST (Infinity) is the largest (Infinity - Infinity is NaN). */
function byNeed(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** One search: the node counter and the transposition table. */
class Search {
  nodes = 0;
  private readonly table = new Map<string, number>();

  constructor(
    private readonly target: Point,
    private readonly maxNodes: number,
  ) {}

  private count() {
    this.nodes += 1;
    if (this.nodes > this.maxNodes) throw new Capped();
  }

  play(state: GameState, point: Point) {
    this.count();
    return play(state, point);
  }

  pass(state: GameState): GameState {
    this.count();
    const result = pass(state);
    // The defender passes only after an attacker move, so the game never ends here.
    if (!result.ok) throw new Error('forcedCapture: pass after the end of the game');
    return result.state;
  }

  isCaptured(board: Board): boolean {
    return board.cells[this.target.y * board.size + this.target.x] === null;
  }

  /**
   * Attacker to move with `r` moves left: the fewest moves that capture against every defence,
   * or LOST when `r` is not enough.
   */
  attack(state: GameState, r: number): number {
    const group = groupAt(state.board, this.target);
    if (!group) return 0;
    // Every attacker move takes at most one liberty (§3.5).
    if (group.liberties.length > r) return LOST;
    const key = `${keyOf(state)}|${r}`;
    const known = this.table.get(key);
    if (known !== undefined) return known;

    let best = LOST;
    for (const point of group.liberties) {
      const limit = Math.min(r, best - 1);
      if (group.liberties.length > limit) break;
      const result = this.play(state, point);
      if (!result.ok) continue;
      if (this.isCaptured(result.state.board)) {
        best = 1;
        break;
      }
      const rest = this.defend(result.state, limit - 1);
      if (rest !== LOST) best = 1 + rest;
    }
    this.table.set(key, best);
    return best;
  }

  /** Defender to move, the attacker has `r` moves left: the attacker's moves needed, or LOST. */
  defend(state: GameState, r: number): number {
    const replies = defenderReplies(state, this.target);
    if (replies.length === 0) return this.attack(this.pass(state), r);
    let worst = 0;
    for (const point of replies) {
      const result = this.play(state, point);
      if (!result.ok) continue;
      const need = this.attack(result.state, r);
      if (need === LOST) return LOST;
      worst = Math.max(worst, need);
    }
    return worst;
  }
}

function keyOf(state: GameState): string {
  const ko = state.koPoint ? state.koPoint.y * state.board.size + state.koPoint.x : -1;
  return `${state.board.cells.map((c) => c ?? '.').join('')}${state.toPlay}${ko}`;
}

function pointOf(at: Point | Vertex, size: BoardSize): Point {
  return typeof at === 'string' ? parseVertex(at, size) : at;
}

const other = (c: Color): Color => (c === 'B' ? 'W' : 'B');

function withTurn(state: GameState, color: Color): GameState {
  return state.toPlay === color ? state : { ...state, toPlay: color, koPoint: null };
}

/**
 * The defender's candidate replies (§3.3), sorted by column then row: legal liberties of the
 * target group and legal moves that capture an attacker group touching it. `state.toPlay` is the
 * defender. Empty when the target is gone or every candidate is illegal (the defender passes).
 */
export function defenderReplies(state: GameState, target: Point | Vertex): Point[] {
  const { board } = state;
  const size = board.size as BoardSize;
  const group = groupAt(board, pointOf(target, size));
  if (!group) return [];
  const cells = new Set<number>(group.liberties.map((p) => p.y * size + p.x));
  const seen = new Set<number>();
  for (const stone of group.stones) {
    for (const n of neighborsOf(stone, size)) {
      const index = n.y * size + n.x;
      if (seen.has(index) || board.cells[index] === null || board.cells[index] === group.color)
        continue;
      const chaser = groupAt(board, n);
      if (!chaser) continue;
      for (const s of chaser.stones) seen.add(s.y * size + s.x);
      if (chaser.liberties.length === 1) {
        const lib = chaser.liberties[0];
        cells.add(lib.y * size + lib.x);
      }
    }
  }
  const legal = new Set(legalMoves(state).map((p) => p.y * size + p.x));
  return [...cells]
    .filter((index) => legal.has(index))
    .sort((a, b) => (a % size) - (b % size) || Math.floor(a / size) - Math.floor(b / size))
    .map((index) => ({ x: index % size, y: Math.floor(index / size) }));
}

function neighborsOf(p: Point, size: number): Point[] {
  const out: Point[] = [];
  if (p.x > 0) out.push({ x: p.x - 1, y: p.y });
  if (p.x < size - 1) out.push({ x: p.x + 1, y: p.y });
  if (p.y > 0) out.push({ x: p.x, y: p.y - 1 });
  if (p.y < size - 1) out.push({ x: p.x, y: p.y + 1 });
  return out;
}

const notForced = (nodes: number, capped: boolean): CaptureSearch => ({
  forced: false,
  moves: null,
  capped,
  nodes,
});

/** Whether the attacker (to move in `state`) captures the target within `maxMoves`. */
export function forcedCapture(state: GameState, problem: CaptureProblem): CaptureSearch {
  const size = state.board.size as BoardSize;
  const target = pointOf(problem.target, size);
  const group = groupAt(state.board, target);
  if (!group || group.color === problem.attacker) return notForced(0, false);
  const search = new Search(target, problem.maxNodes ?? FORCED_CAPTURE_MAX_NODES);
  try {
    const need = search.attack(withTurn(state, problem.attacker), problem.maxMoves);
    return need === LOST
      ? notForced(search.nodes, false)
      : { forced: true, moves: need, capped: false, nodes: search.nodes };
  } catch (error) {
    if (error instanceof Capped) return notForced(search.nodes, true);
    throw error;
  }
}

/**
 * Judges one attacker move at any legal point (the learner's tap, §3.4) and picks the reply to
 * show (§3.3): replies that escape first, else the longest resistance; then most liberties of the
 * target group after the reply; then lowest column; then lowest row.
 */
export function judgeAttack(
  state: GameState,
  problem: CaptureProblem,
  at: Point | Vertex,
): AttackJudgement {
  const size = state.board.size as BoardSize;
  const start = withTurn(state, problem.attacker);
  const target = pointOf(problem.target, size);
  const point = pointOf(at, size);
  const search = new Search(target, problem.maxNodes ?? FORCED_CAPTURE_MAX_NODES);
  const played = play(start, point);
  if (!played.ok) return played;
  search.nodes = 1;
  const base = { ok: true as const, state: played.state, facts: played.facts };
  if (groupAt(start.board, target)?.color !== other(problem.attacker)) {
    return { ...base, ...notForced(1, false), captured: false, reply: { kind: 'none' } };
  }
  if (search.isCaptured(played.state.board)) {
    return {
      ...base,
      forced: true,
      moves: 1,
      capped: false,
      nodes: 1,
      captured: true,
      reply: { kind: 'none' },
    };
  }

  const left = problem.maxMoves - 1;
  try {
    const replies = defenderReplies(played.state, target);
    if (replies.length === 0) {
      const passed = search.pass(played.state);
      const need = search.attack(passed, left);
      const reply: AttackReply = { kind: 'pass', state: passed };
      return need === LOST
        ? { ...base, ...notForced(search.nodes, false), captured: false, reply }
        : {
            ...base,
            forced: true,
            moves: 1 + need,
            capped: false,
            nodes: search.nodes,
            captured: false,
            reply,
          };
    }
    const options = replies.flatMap((p) => {
      const result = search.play(played.state, p);
      if (!result.ok) return [];
      const need = search.attack(result.state, left);
      const libs = groupAt(result.state.board, target)?.liberties.length ?? 0;
      return [{ point: p, result, need, libs }];
    });
    options.sort(
      (a, b) =>
        byNeed(b.need, a.need) || b.libs - a.libs || a.point.x - b.point.x || a.point.y - b.point.y,
    );
    const shown = options[0];
    const reply: AttackReply = {
      kind: 'play',
      point: shown.point,
      state: shown.result.state,
      facts: shown.result.facts,
    };
    return shown.need === LOST
      ? { ...base, ...notForced(search.nodes, false), captured: false, reply }
      : {
          ...base,
          forced: true,
          moves: 1 + shown.need,
          capped: false,
          nodes: search.nodes,
          captured: false,
          reply,
        };
  } catch (error) {
    if (!(error instanceof Capped)) throw error;
    return { ...base, ...notForced(search.nodes, true), captured: false, reply: { kind: 'none' } };
  }
}

/**
 * The attacker's winning moves among `candidates` (default: the legal liberties of the target
 * group, the proof set of §3.4), ordered for the hint ring (AC 20).
 */
export function winningMoves(
  state: GameState,
  problem: CaptureProblem,
  candidates?: readonly Point[],
): WinningMoves {
  const size = state.board.size as BoardSize;
  const target = pointOf(problem.target, size);
  const points = candidates ?? groupAt(state.board, target)?.liberties ?? [];
  const moves: WinningMoves['moves'] = [];
  let nodes = 0;
  let capped = false;
  for (const point of points) {
    const j = judgeAttack(state, problem, point);
    if (!j.ok) continue;
    nodes += j.nodes;
    capped ||= j.capped;
    if (j.forced && j.moves !== null) moves.push({ point, moves: j.moves });
  }
  moves.sort((a, b) => a.moves - b.moves || a.point.x - b.point.x || a.point.y - b.point.y);
  return { moves, capped, nodes };
}
