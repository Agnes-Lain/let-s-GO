// Spec docs/specs/M6b-13x13-bot-tuning.md §4.6 (AC 25–27, 29–30): the review 复盘 on 13×13.
import {
  createGame,
  legalMoves,
  parseVertex,
  pass,
  play,
  type GameState,
  type Move,
  type Vertex,
} from '@/engine';

import { createRng, winRate, deriveSeed } from '@/bot';

import {
  REVIEW_CHUNK,
  SWING_MAX_PLIES,
  SWING_MAX_PLIES_13,
  SWING_PLAYOUTS,
  SWING_POSITIONS,
  buildReview,
  evaluatePosition,
  planReview,
  reviewMoments,
  swingMaxPlies,
} from './review';

const KOMI = 6.5;
/** As in __tests__/perf/speed13.test.ts: strict bounds with `npm run test:speed`, 1.5× in `npm test`. */
const SLACK = process.env.SPEED_STRICT === '1' ? 1 : 1.5;

/** Moves from vertices played alternately from the start position ('pass' passes). */
function movesOf(vertices: string[], start: GameState = createGame(13, { komi: KOMI })): Move[] {
  let state = start;
  for (const v of vertices) {
    const result = v === 'pass' ? pass(state) : play(state, v);
    if (!result.ok) throw new Error(`${v} is illegal: ${result.reason}`);
    state = result.state;
  }
  return [...state.moves];
}

/** A seeded random 13×13 game: `plies` random legal moves (passes when there is none). */
function randomGame(plies: number, seed: number): GameState[] {
  const rng = createRng(seed);
  let state = createGame(13, { komi: KOMI });
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

// White surrounds Black k10 l10 m10 and takes all three with n10 at ply 16:
//
//   11 . . . . . . . . O O O . .
//   10 . . . . . . . O X X X * .    (* = n10)
//    9 . . . . . . . . O O O . .
//       a b c d e f g h j k l m n
const CAPTURE_THREE = movesOf([
  ...['k10', 'j10', 'l10', 'k11', 'm10', 'l11', 'c3', 'm11'],
  ...['c5', 'k9', 'c7', 'l9', 'c9', 'm9', 'e3', 'n10'],
]);

describe('planReview on 13×13 (AC 25, 29)', () => {
  it('AC 29: the replay position after k moves equals the engine position (with captures)', () => {
    const states = randomGame(160, 4);
    const moves = [...states[states.length - 1].moves];
    expect(
      states[states.length - 1].captures.B + states[states.length - 1].captures.W,
    ).toBeGreaterThan(0);
    const plan = planReview(moves, KOMI, 1, 'B', 13);
    expect(plan.size).toBe(13);
    expect(plan.states).toHaveLength(moves.length + 1);
    for (let k = 0; k < states.length; k++) {
      expect(plan.states[k].board).toEqual(states[k].board);
      expect(plan.states[k].captures).toEqual(states[k].captures);
    }
  });

  it('AC 25: the default size is 9, so old calls are unchanged', () => {
    const moves = movesOf(['e5', 'c3'], createGame(9, { komi: 5.5 }));
    const plan = planReview(moves, 5.5, 1);
    expect(plan.size).toBe(9);
    expect(plan.states[0].board.size).toBe(9);
    expect(planReview(moves, 5.5, 1, 'B', 9)).toEqual(plan);
  });

  it('a handicap game replays from the handicap stones, White first', () => {
    const stones: Vertex[] = ['d4', 'k10'];
    const start = createGame(13, { komi: 0.5, setup: { B: stones }, toPlay: 'W' });
    const moves = movesOf(['g7', 'c3', 'k4'], start);
    const plan = planReview(moves, 0.5, 1, 'B', 13, stones);
    expect(plan.states[0].board).toEqual(start.board);
    const g7 = parseVertex('g7', 13);
    expect(plan.states[1].board.cells[g7.y * 13 + g7.x]).toBe('W');
    expect(plan.states[3].toPlay).toBe('B');
    expect(moves.map((m) => m.color)).toEqual(['W', 'B', 'W']);
  });
});

describe('moments on 13×13 (AC 25–26)', () => {
  it('AC 26: the bot takes 3 learner stones: one lostGroup moment at k10', () => {
    const moments = reviewMoments(planReview(CAPTURE_THREE, KOMI, 1, 'B', 13), null);
    expect(moments).toEqual([
      {
        kind: 'lostGroup',
        ply: 16,
        point: parseVertex('k10', 13),
        note: { key: 'coach.review.lostGroup.since', params: { n: 16, k: 3, m: 14 } },
      },
    ]);
  });

  it('AC 29: a capture names the 13×13 point ("K10", never "I")', () => {
    const moments = reviewMoments(planReview(CAPTURE_THREE, KOMI, 1, 'W', 13), null);
    expect(moments).toEqual([
      {
        kind: 'bigCapture',
        ply: 16,
        point: parseVertex('k10', 13),
        note: { key: 'coach.review.bigCapture.W', params: { n: 16, k: 3, point: 'K10' } },
      },
    ]);
  });

  it('AC 25: same moves and seed give the same review; moments sorted by ply, 0–3', () => {
    const moves = [...randomGame(140, 3).at(-1)!.moves];
    const a = buildReview(moves, KOMI, 42, 'B', 13);
    expect(buildReview(moves, KOMI, 42, 'B', 13)).toEqual(a);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a.map((m) => m.ply)).toEqual([...a.map((m) => m.ply)].sort((x, y) => x - y));
    for (const m of a) {
      if (m.note.params && 'point' in m.note.params) {
        expect(String(m.note.params.point)).toMatch(/^[A-HJ-N]\d{1,2}$/);
      }
    }
  });
});

describe('review budget on 13×13 (AC 26–27)', () => {
  it('AC 26: 24 positions, 40 playouts, playout cap 160 on 13×13 (80 on 9×9)', () => {
    expect(SWING_POSITIONS).toBe(24);
    expect(SWING_PLAYOUTS).toBe(40);
    expect(SWING_MAX_PLIES).toBe(80);
    expect(SWING_MAX_PLIES_13).toBe(160);
    expect(swingMaxPlies(9)).toBe(80);
    expect(swingMaxPlies(13)).toBe(160);
    expect(REVIEW_CHUNK).toBe(4);
  });

  it('AC 26: evaluatePosition on 13×13 uses 40 playouts of at most 160 plies', () => {
    const moves = [...randomGame(60, 8).at(-1)!.moves];
    const plan = planReview(moves, KOMI, 5, 'B', 13);
    const at = plan.positions[3];
    expect(evaluatePosition(plan, 3)).toBe(
      winRate(plan.states[at], 'B', SWING_PLAYOUTS, SWING_MAX_PLIES_13, deriveSeed(5, at)),
    );
  });

  it('AC 27: a 100-move game is reviewed in ≤ 600 ms, each chunk of 4 positions ≤ 100 ms', () => {
    const moves = [...randomGame(100, 11).at(-1)!.moves];
    const plan = planReview(moves, KOMI, 3, 'B', 13);
    expect(plan.positions).toHaveLength(SWING_POSITIONS + 1);
    evaluatePosition(plan, 0); // warm-up (JIT)
    // Each chunk: the fastest of 3 runs (seeded, so the same work), which drops the time the OS
    // gave to the other Jest workers; the total is the sum of the chunks.
    const chunks: number[] = [];
    for (let i = 0; i < plan.positions.length; i += REVIEW_CHUNK) {
      let best = Infinity;
      for (let r = 0; r < 3; r++) {
        const t0 = performance.now();
        for (let k = i; k < Math.min(i + REVIEW_CHUNK, plan.positions.length); k++) {
          evaluatePosition(plan, k);
        }
        best = Math.min(best, performance.now() - t0);
      }
      chunks.push(best);
    }
    const total = chunks.reduce((n, t) => n + t, 0);
    if (SLACK === 1) {
      console.log(
        `review 13×13: total ${total.toFixed(0)} ms, max chunk ${Math.max(...chunks).toFixed(0)} ms`,
      );
    }
    expect(total).toBeLessThanOrEqual(600 * SLACK);
    expect(Math.max(...chunks)).toBeLessThanOrEqual(100 * SLACK);
  });
});
