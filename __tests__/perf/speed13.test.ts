// Spec docs/specs/M6b-13x13-bot-tuning.md §4.4 (AC 13): desktop time per move on 13×13, the proxy
// for a mid-range phone (× 6). Positions come from a seeded level-2 self-play (13×13 slip): 20
// evenly spaced plies of the game (at most plies 0–200). Timing lives only here and in the tuning
// script: src/bot itself has no clock (AC 12).
import { createGame, pass, play, type GameState, type Move } from '@/engine';
import { botRng, chooseMove, proposeDead, type BotLevel } from '@/bot';
import { hintFor } from '@/coach';
import { levelKnobs } from '@/game9/config';

function apply(state: GameState, move: Move): GameState {
  const result = move.type === 'pass' ? pass(state) : play(state, move.point);
  if (!result.ok) throw new Error(`illegal: ${result.reason}`);
  return result.state;
}

/** Every position of a 13×13 level-2 self-play, up to ply 200. */
function selfPlay(seed: number): GameState[] {
  let state = createGame(13, { komi: 6.5 });
  const states = [state];
  while (!state.isOver && state.moves.length < 200) {
    const { move } = chooseMove(state, {
      level: 2,
      rng: botRng(seed, state.moves.length),
      boardN: true,
      ...levelKnobs(2, 13),
    });
    state = apply(state, move);
    states.push(state);
  }
  return states;
}

/**
 * `npm run test:speed` (SPEED_STRICT=1) checks the spec's numbers with Jest alone on the machine.
 * Inside the full `npm test` about ten Jest workers share the CPU (some on efficiency cores), so
 * the same bounds get 1.5× slack there; a real regression still fails both.
 * GitHub's shared CI runners are slower and noisier still (2 vCPUs, other tenants), so on CI the
 * bounds get 2.5× — enough to absorb runner jitter while an algorithmic regression (several ×)
 * still fails. The spec budgets themselves are checked by `npm run test:speed`.
 */
const STRICT = process.env.SPEED_STRICT === '1';
const SLACK = STRICT ? 1 : process.env.CI ? 2.5 : 1.5;
const report = (name: string, times: number[]) => {
  if (STRICT) {
    console.log(
      `${name}: mean ${mean(times).toFixed(1)} ms, p95 ${p95(times).toFixed(1)} ms, ` +
        `max ${Math.max(...times).toFixed(1)} ms`,
    );
  }
};

const GAME = selfPlay(3);
const last = GAME.length - 1;
/** 20 evenly spaced positions, from the empty board to the end of the game. */
const POSITIONS = Array.from({ length: 20 }, (_, i) => GAME[Math.round((i * last) / 19)]);
/** Late positions for the dead-stone proposal: every 2nd ply from 120 on, at most 10. */
const LATE = GAME.filter((s) => s.moves.length >= 120 && s.moves.length % 2 === 0).slice(0, 10);

/** Index ⌈0.95 n⌉ − 1 of the sorted times (the 19th of 20). */
function p95(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)];
}

const mean = (times: number[]) => times.reduce((n, t) => n + t, 0) / times.length;

/**
 * Time per position: the fastest of `repeats` runs. The work is deterministic (seeded), so the
 * minimum drops only the time the OS gave to the other Jest workers running in parallel; the
 * phone factor (× 6) already assumes one busy core.
 */
function timeEach(
  positions: GameState[],
  run: (state: GameState, i: number) => void,
  repeats = 3,
): number[] {
  run(positions[Math.min(5, positions.length - 1)], 0); // warm-up (JIT)
  return positions.map((state, i) => {
    let best = Infinity;
    for (let k = 0; k < repeats; k++) {
      const start = performance.now();
      run(state, i);
      best = Math.min(best, performance.now() - start);
    }
    return best;
  });
}

describe('AC 13: 13×13 speed on desktop (phone ≈ × 6)', () => {
  it('has 20 positions from the empty board to a game of at least 130 plies', () => {
    expect(POSITIONS).toHaveLength(20);
    expect(POSITIONS[0].moves).toHaveLength(0);
    expect(POSITIONS[19].moves.length).toBeGreaterThanOrEqual(130);
  });

  const choose = (level: BotLevel) => (state: GameState, i: number) =>
    chooseMove(state, {
      level,
      rng: botRng(i, state.moves.length),
      boardN: true,
      ...levelKnobs(level, 13),
    });

  it('level 3: mean ≤ 250 ms, p95 ≤ 330 ms, max ≤ 500 ms', () => {
    const times = timeEach(POSITIONS, choose(3));
    report('level 3', times);
    expect(mean(times)).toBeLessThanOrEqual(250 * SLACK);
    expect(p95(times)).toBeLessThanOrEqual(330 * SLACK);
    expect(Math.max(...times)).toBeLessThanOrEqual(500 * SLACK);
  });

  it.each([1, 2] as BotLevel[])('level %i: mean ≤ 5 ms, p95 ≤ 20 ms', (level) => {
    const times = timeEach(POSITIONS, choose(level));
    report(`level ${level}`, times);
    expect(mean(times)).toBeLessThanOrEqual(5 * SLACK);
    expect(p95(times)).toBeLessThanOrEqual(20 * SLACK);
  });

  it('hint: p95 ≤ 50 ms', () => {
    const times = timeEach(POSITIONS, (state) => hintFor(state));
    report('hint', times);
    expect(p95(times)).toBeLessThanOrEqual(50 * SLACK);
  });

  it('dead-stone proposal (ply ≥ 120): p95 ≤ 250 ms', () => {
    expect(LATE.length).toBeGreaterThanOrEqual(5);
    const times = timeEach(LATE, (state, i) => proposeDead(state, botRng(i, 0xdead)));
    report('dead-stone proposal', times);
    expect(p95(times)).toBeLessThanOrEqual(250 * SLACK);
  });
});
