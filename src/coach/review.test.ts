// Spec docs/specs/M6-game-coaching.md §4.4 (AC 25–33): the post-game review 复盘 fùpán.
import {
  createGame,
  legalMoves,
  parseVertex,
  pass,
  play,
  type Color,
  type GameState,
  type Move,
} from '@/engine';

import { createRng } from '@/bot';

import {
  REVIEW_CHUNK,
  SWING_MAX_PLIES,
  SWING_PLAYOUTS,
  SWING_POSITIONS,
  SWING_THRESHOLD,
  buildReview,
  evaluatePosition,
  planReview,
  reviewMoments,
} from './review';

const KOMI = 5.5;

/** Moves from vertices played alternately from Black ('pass' passes). */
function movesOf(vertices: string[]): Move[] {
  let state = createGame(9, { komi: KOMI });
  for (const v of vertices) {
    const result = v === 'pass' ? pass(state) : play(state, v);
    if (!result.ok) throw new Error(`${v} is illegal: ${result.reason}`);
    state = result.state;
  }
  return [...state.moves];
}

/** A seeded random game: `plies` random legal moves (passes when there is none). */
function randomGame(plies: number, seed: number): GameState[] {
  const rng = createRng(seed);
  let state = createGame(9, { komi: KOMI });
  const states = [state];
  for (let k = 0; k < plies && !state.isOver; k++) {
    const moves = legalMoves(state);
    const result =
      moves.length === 0 ? pass(state) : play(state, moves[Math.floor(rng() * moves.length)]);
    if (!result.ok) throw new Error('random game: illegal move');
    state = result.state;
    states.push(state);
  }
  return states;
}

// 20 quiet plies far apart, then White surrounds Black b1 c1 d1 e1 and captures all four with f1
// at ply 32 (a bot move: the learner is Black and plays the odd plies).
//
//   2 . O O O O . . . .        after ply 32:   2 . O O O O . . . .
//   1 O X X X X * . . .   (* = f1)              1 O . . . . O . . .
const QUIET = [
  ...['a9', 'a5', 'c9', 'c5', 'e9', 'e5', 'g9', 'g5', 'j9', 'j5'],
  ...['a7', 'a3', 'c7', 'c3', 'e7', 'e3', 'g7', 'g3', 'j7', 'j3'],
];
const LOST_FOUR = movesOf([
  ...QUIET,
  ...['b1', 'b2', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'b8', 'a1', 'd8', 'f1'],
]);

describe('planReview (AC 25, 27, 33)', () => {
  it('AC 33: the replay position after k moves equals playing the first k moves', () => {
    const states = randomGame(90, 5);
    const moves = [...states[states.length - 1].moves];
    const plan = planReview(moves, KOMI, 1);
    expect(plan.states).toHaveLength(moves.length + 1);
    for (let k = 0; k < states.length; k++) {
      expect(plan.states[k].board).toEqual(states[k].board);
      expect(plan.states[k].captures).toEqual(states[k].captures);
    }
  });

  it('AC 27: only positions after the learner’s own moves (after ply 6), at most 24 + 1 baseline', () => {
    const moves = [...randomGame(120, 9).at(-1)!.moves];
    const plan = planReview(moves, KOMI, 1);
    expect(plan.positions.length).toBeLessThanOrEqual(SWING_POSITIONS + 1);
    const [baseline, ...evaluated] = plan.positions;
    expect(baseline).toBe(evaluated[0] - 1);
    for (const ply of evaluated) {
      expect(ply).toBeGreaterThan(6);
      const move = moves[ply - 1];
      expect(move).toMatchObject({ type: 'play', color: 'B' });
    }
    // Evenly sampled: increasing, first and last learner move after ply 6 kept.
    expect([...evaluated].sort((a, b) => a - b)).toEqual(evaluated);
    expect(new Set(evaluated).size).toBe(evaluated.length);
    // Budget: ≤ 25 positions × 40 playouts ≤ 1 000, cap 80 plies, 4 positions per tick.
    expect(plan.positions.length * SWING_PLAYOUTS).toBeLessThanOrEqual(1000);
    expect(SWING_PLAYOUTS).toBe(40);
    expect(SWING_MAX_PLIES).toBe(80);
    expect(REVIEW_CHUNK).toBe(4);
  });

  it('a short game evaluates every learner move after ply 6', () => {
    const plan = planReview(LOST_FOUR, KOMI, 1);
    expect(plan.positions).toEqual([6, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
  });
});

describe('reviewMoments: capture moments (AC 26, 31)', () => {
  it('AC 26: the bot captured 4 stones at ply 32: one lostGroup moment', () => {
    const plan = planReview(LOST_FOUR, KOMI, 1);
    const moments = reviewMoments(plan, null);
    expect(moments).toEqual([
      {
        kind: 'lostGroup',
        ply: 32,
        point: parseVertex('b1', 9),
        note: { key: 'coach.review.lostGroup', params: { n: 32, k: 4, count: 1 } },
      },
    ]);
  });

  it('bigCapture: the learner captures 2 stones (Black or White named)', () => {
    //   2 . . . X X . . . .
    //   1 . . X O O * . . .   Black f1 (*) at ply 27 takes d1 e1.
    const moves = movesOf([...QUIET, ...['c1', 'd1', 'd2', 'e1', 'e2', 'h8', 'f1']]);
    const moments = reviewMoments(planReview(moves, KOMI, 1), null);
    expect(moments).toEqual([
      {
        kind: 'bigCapture',
        ply: 27,
        point: parseVertex('d1', 9),
        note: { key: 'coach.review.bigCapture.B', params: { n: 27, k: 2, point: 'd1' } },
      },
    ]);
  });

  it('single-stone captures are not moments', () => {
    const moves = movesOf([...QUIET, 'b1', 'a1', 'a2']);
    expect(reviewMoments(planReview(moves, KOMI, 1), null)).toEqual([]);
  });
});

describe('reviewMoments: swing (AC 28, 29, 31)', () => {
  const plan = planReview(LOST_FOUR, KOMI, 1);
  const flat = (p: number) => plan.positions.map(() => p);

  it('AC 28: a drop of ≥ 0.30 after a learner move is a swing at that ply', () => {
    const chances = flat(0.6);
    // positions[5] = ply 15 (a learner move).
    for (let i = 5; i < chances.length; i++) chances[i] = 0.6 - SWING_THRESHOLD;
    const swing = reviewMoments(plan, chances).find((m) => m.kind === 'swing');
    expect(swing).toEqual({
      kind: 'swing',
      ply: 15,
      point: parseVertex('e7', 9),
      note: { key: 'coach.review.swing', params: { n: 15, point: 'e7' } },
      reply: { key: 'coach.review.reply.none' },
    });
  });

  it('AC 29: drops below 0.30 make no swing (capture moments still show)', () => {
    const chances = flat(0.6);
    chances[3] = 0.31;
    const moments = reviewMoments(plan, chances);
    expect(moments.map((m) => m.kind)).toEqual(['lostGroup']);
  });

  it("AC 31: the swing reply is the bot's reply fact (it captured 4 stones)", () => {
    const chances = flat(0.7);
    chances[chances.length - 1] = 0.1; // after ply 31; the bot then captures at ply 32
    const moments = reviewMoments(plan, chances);
    expect(moments.map((m) => [m.kind, m.ply])).toEqual([
      ['swing', 31],
      ['lostGroup', 32],
    ]);
    expect(moments[0].reply).toEqual({ key: 'coach.review.reply.capture', params: { count: 4 } });
  });
});

describe('buildReview (AC 25, 27)', () => {
  it('AC 25: same moves and seed give the same review; moments sorted by ply, 0–3', () => {
    const moves = [...randomGame(80, 3).at(-1)!.moves];
    const a = buildReview(moves, KOMI, 42);
    expect(buildReview(moves, KOMI, 42)).toEqual(a);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a.map((m) => m.ply)).toEqual([...a.map((m) => m.ply)].sort((x, y) => x - y));
  });

  it('evaluatePosition is a seeded win chance in [0, 1]', () => {
    const plan = planReview(LOST_FOUR, KOMI, 7);
    const p = evaluatePosition(plan, 2);
    expect(p).toBe(evaluatePosition(plan, 2));
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('works for a White learner too', () => {
    const plan = planReview(LOST_FOUR, KOMI, 1, 'W' as Color);
    expect(plan.positions.slice(1).every((ply) => ply % 2 === 0)).toBe(true);
    const moments = reviewMoments(plan, null);
    expect(moments.map((m) => m.kind)).toEqual(['bigCapture']);
    expect(moments[0].note.key).toBe('coach.review.bigCapture.W');
  });
});

describe('review cost (AC 27)', () => {
  it('a long game (≥ 24 learner moves) is reviewed in well under 1.5 s on desktop Node', () => {
    const moves = [...randomGame(140, 11).at(-1)!.moves];
    const plan = planReview(moves, KOMI, 3);
    expect(plan.positions).toHaveLength(SWING_POSITIONS + 1);
    const start = performance.now();
    buildReview(moves, KOMI, 3);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
