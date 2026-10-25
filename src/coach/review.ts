// The post-game review 复盘 fùpán (spec docs/specs/M6-game-coaching.md §4.4): replay a finished
// game with the engine and pick 1–3 key moments, each with an engine fact line. Pure and seeded:
// the UI evaluates the positions a few per tick (REVIEW_CHUNK) and may skip them; this module has
// no clock and no timers.
import { deriveSeed, winRate } from '@/bot';
import {
  createGame,
  groupAt,
  pass,
  play,
  toVertex,
  type BoardSize,
  type Color,
  type GameState,
  type Move,
  type MoveFacts,
  type Point,
  type Vertex,
} from '@/engine';

import { factParams, moveNote, pickFact, type CoachFact, type CoachNote } from './facts';

/** The review is offered from this many moves on (AC 9 of §9). */
export const REVIEW_MIN_MOVES = 10;
/** Swing budget (AC 27): positions after the learner's moves, playouts each, plies per playout. */
export const SWING_POSITIONS = 24;
export const SWING_PLAYOUTS = 40;
export const SWING_MAX_PLIES = 80;
/** 13×13 (M6b-2 AC 26): twice the plies per playout, same positions and playouts. */
export const SWING_MAX_PLIES_13 = 160;

/** Plies per swing playout of a board size. */
export function swingMaxPlies(size: number): number {
  return size >= 13 ? SWING_MAX_PLIES_13 : SWING_MAX_PLIES;
}
/** Learner moves up to this ply are the opening and not evaluated. */
export const SWING_FROM_PLY = 6;
/** A swing is a drop of at least this much win chance (AC 28). */
export const SWING_THRESHOLD = 0.3;
/** Positions the UI evaluates per tick (AC 27). */
export const REVIEW_CHUNK = 4;
/** Smallest capture that is a moment, and smallest lost learner group (§4.4). */
export const BIG_CAPTURE_MIN = 2;
export const LOST_GROUP_MIN = 3;

export type MomentKind = 'bigCapture' | 'lostGroup' | 'swing';

export interface ReviewMoment {
  kind: MomentKind;
  /** Move number (1 = the first move). */
  ply: number;
  /** The key point marked on the board when the moment is shown. */
  point: Point;
  /** The fact line (AC 31). */
  note: CoachNote;
  /** Swing only: what the bot's next reply did (`{{reply}}` of the fact line). */
  reply?: CoachNote;
}

export interface ReviewPlan {
  moves: readonly Move[];
  learner: Color;
  seed: number;
  /** Board size (9 or 13, M6b-2 AC 25). */
  size: number;
  /** states[k] = the position after the first k moves (AC 33). */
  states: GameState[];
  /** facts[k] = the engine facts of move k (index 0 and passes: null). */
  facts: (MoveFacts | null)[];
  /**
   * The positions (state indexes) whose win chance is evaluated: a baseline, then the positions
   * after the sampled learner moves (empty when there is no learner move after the opening).
   */
  positions: number[];
}

/** The positions after up to SWING_POSITIONS learner moves after the opening, evenly sampled. */
function swingPositions(moves: readonly Move[], learner: Color): number[] {
  const plies: number[] = [];
  moves.forEach((move, i) => {
    const ply = i + 1;
    if (ply > SWING_FROM_PLY && move.type === 'play' && move.color === learner) plies.push(ply);
  });
  if (plies.length === 0) return [];
  const sampled =
    plies.length <= SWING_POSITIONS
      ? plies
      : Array.from(
          { length: SWING_POSITIONS },
          (_, j) => plies[Math.round((j * (plies.length - 1)) / (SWING_POSITIONS - 1))],
        );
  return [sampled[0] - 1, ...sampled];
}

/** The start of a replay: handicap stones (Black) mean White moves first (M6-beginner-friendly). */
function startOf(size: number, komi: number, handicap: readonly Vertex[]): GameState {
  const boardSize = size as BoardSize;
  return handicap.length > 0
    ? createGame(boardSize, { komi, setup: { B: [...handicap] }, toPlay: 'W' })
    : createGame(boardSize, { komi });
}

/**
 * Replays `moves` on a `size` board (default 9) with the engine, from the handicap stones when
 * given (throws on an illegal move).
 */
export function planReview(
  moves: readonly Move[],
  komi: number,
  seed: number,
  learner: Color = 'B',
  size = 9,
  handicap: readonly Vertex[] = [],
): ReviewPlan {
  let state = startOf(size, komi, handicap);
  const states = [state];
  const facts: (MoveFacts | null)[] = [null];
  for (const move of moves) {
    if (move.type === 'pass') {
      const result = pass(state);
      if (!result.ok) throw new Error('review: pass refused');
      state = result.state;
      facts.push(null);
    } else {
      const result = play(state, move.point);
      if (!result.ok) throw new Error(`review: illegal move (${result.reason})`);
      state = result.state;
      facts.push(result.facts);
    }
    states.push(state);
  }
  return {
    moves,
    learner,
    seed,
    size,
    states,
    facts,
    positions: swingPositions(moves, learner),
  };
}

/** Win chance of the learner at `plan.positions[index]` (AC 28): seeded random playouts. */
export function evaluatePosition(plan: ReviewPlan, index: number): number {
  const at = plan.positions[index];
  return winRate(
    plan.states[at],
    plan.learner,
    SWING_PLAYOUTS,
    swingMaxPlies(plan.size),
    deriveSeed(plan.seed, at),
  );
}

/** The bot's reply fact as a clause of the swing line (the §4.1 texts, AC 31). */
function replyNote(fact: CoachFact): CoachNote {
  const params = factParams(fact);
  switch (fact.kind) {
    case 'capture':
      return { key: 'coach.review.reply.capture', params };
    case 'selfAtari':
      return { key: 'coach.review.reply.selfAtari', params };
    case 'exposed':
      return { key: 'coach.review.reply.exposed', params };
    case 'atari':
      return { key: 'coach.review.reply.atari', params };
    case 'escape':
      return { key: 'coach.review.reply.escape' };
  }
}

function firstPoint(points: readonly Point[]): Point {
  return [...points].sort((a, b) => a.x - b.x || a.y - b.y)[0];
}

function bigParams(ply: number, k: number, point: Point, size: number) {
  return { n: ply, k, point: toVertex(point, size as BoardSize).toUpperCase() };
}

/** True when `stones` are exactly one group with one liberty in `state`. */
function inAtariAsIs(state: GameState, stones: readonly Point[]): boolean {
  const group = groupAt(state.board, stones[0]);
  return (
    group !== null &&
    group.liberties.length === 1 &&
    group.stones.length === stones.length &&
    stones.every((p) => group.stones.some((q) => q.x === p.x && q.y === p.y))
  );
}

/**
 * The move since which a group captured at `ply` was in atari with the same stones: walk back
 * from the position before the capture while the group is unchanged and has one liberty.
 */
export function atariSince(
  states: readonly GameState[],
  ply: number,
  stones: readonly Point[],
): number {
  let since = ply - 1;
  while (since > 1 && inAtariAsIs(states[since - 1], stones)) since--;
  return since;
}

function captureMoments(plan: ReviewPlan): ReviewMoment[] {
  const { moves, states, facts, learner } = plan;
  let big: ReviewMoment | null = null;
  let bigCount = BIG_CAPTURE_MIN - 1;
  let lost: ReviewMoment | null = null;
  let lostSize = LOST_GROUP_MIN - 1;
  for (let ply = 1; ply < facts.length; ply++) {
    const f = facts[ply];
    if (!f || f.captured.length === 0) continue;
    const mover = moves[ply - 1].color;
    const stones = f.captured.flat();
    if (stones.length > bigCount) {
      bigCount = stones.length;
      const point = firstPoint(stones);
      big = {
        kind: 'bigCapture',
        ply,
        point,
        note:
          mover === 'B'
            ? {
                key: 'coach.review.bigCapture.B',
                params: bigParams(ply, stones.length, point, plan.size),
              }
            : {
                key: 'coach.review.bigCapture.W',
                params: bigParams(ply, stones.length, point, plan.size),
              },
      };
    }
    if (mover === learner) continue;
    for (const group of f.captured) {
      if (group.length <= lostSize) continue;
      lostSize = group.length;
      const point = firstPoint(group);
      const since = atariSince(states, ply, group);
      lost = {
        kind: 'lostGroup',
        ply,
        point,
        note:
          since === ply - 1
            ? { key: 'coach.review.lostGroup.oneMove', params: { n: ply, k: group.length } }
            : {
                key: 'coach.review.lostGroup.since',
                params: { n: ply, k: group.length, m: since },
              },
      };
    }
  }
  if (big && lost && big.ply === lost.ply) big = null;
  return [big, lost].filter((m): m is ReviewMoment => m !== null);
}

/** What the bot's reply after the learner's move at `ply` did, as a clause (AC 31). */
function replyOf(plan: ReviewPlan, ply: number): CoachNote {
  const move = plan.moves[ply];
  const facts = plan.facts[ply + 1] ?? null;
  if (move && move.type === 'play' && move.color !== plan.learner && facts) {
    const fact = pickFact(
      moveNote(plan.states[ply], move, plan.states[ply + 1], facts),
      plan.learner,
    );
    if (fact) return replyNote(fact);
  }
  return { key: 'coach.review.reply.none' };
}

function swingMoment(plan: ReviewPlan, chances: readonly number[]): ReviewMoment | null {
  let best = -1;
  let drop = SWING_THRESHOLD - 1e-9;
  for (let i = 1; i < Math.min(chances.length, plan.positions.length); i++) {
    const d = chances[i - 1] - chances[i];
    if (d >= drop && (best < 0 || d > drop)) {
      best = i;
      drop = d;
    }
  }
  if (best < 0) return null;
  const ply = plan.positions[best];
  const move = plan.moves[ply - 1];
  if (move.type !== 'play') return null;
  return {
    kind: 'swing',
    ply,
    point: move.point,
    note: {
      key: 'coach.review.swing',
      params: { n: ply, point: toVertex(move.point, plan.size as BoardSize).toUpperCase() },
    },
    reply: replyOf(plan, ply),
  };
}

/**
 * The key moments, sorted by move (AC 25–31): the biggest capture (≥ 2 stones), the biggest lost
 * learner group (≥ 3; shown once when it is the same move) and, when `chances` are given (one per
 * plan position), the biggest drop of ≥ 0.30 after a learner move. `chances` null (Skip, or the
 * playouts failed): capture moments only.
 */
export function reviewMoments(plan: ReviewPlan, chances: readonly number[] | null): ReviewMoment[] {
  const moments = captureMoments(plan);
  const swing = chances ? swingMoment(plan, chances) : null;
  if (swing && !moments.some((m) => m.ply === swing.ply)) moments.push(swing);
  return moments.sort((a, b) => a.ply - b.ply);
}

/** The whole review at once (tests, tuning): plan, every win chance, moments. */
export function buildReview(
  moves: readonly Move[],
  komi: number,
  seed: number,
  learner: Color = 'B',
  size = 9,
  handicap: readonly Vertex[] = [],
): ReviewMoment[] {
  const plan = planReview(moves, komi, seed, learner, size, handicap);
  const chances = plan.positions.map((_, i) => evaluatePosition(plan, i));
  return reviewMoments(plan, chances);
}
