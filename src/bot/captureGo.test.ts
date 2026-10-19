import { createGame, pass, type GameState } from '@/engine';

import { playAt } from './__fixtures__/board';
import {
  captureGoStatus,
  chooseMove,
  createRng,
  playCaptureGo,
  referencePlayout,
  type CaptureGoConfig,
} from './index';

const rules = { n: 2, player: 'B' as const, maxMoves: 50 };

function withCaptures(B: number, W: number, extra: Partial<GameState> = {}): GameState {
  return { ...createGame(5), captures: { B, W }, ...extra };
}

describe('captureGoStatus (spec AC 19, 21)', () => {
  it('playing while nobody has n captures', () => {
    expect(captureGoStatus(withCaptures(1, 1), rules)).toBe('playing');
  });

  it('won / lost at n, an overshoot counts', () => {
    expect(captureGoStatus(withCaptures(2, 0), rules)).toBe('won');
    expect(captureGoStatus(withCaptures(3, 1), rules)).toBe('won');
    expect(captureGoStatus(withCaptures(0, 2), rules)).toBe('lost');
    expect(captureGoStatus(withCaptures(0, 2), { ...rules, player: 'W' })).toBe('won');
  });

  it('at the move limit or after two passes: more captures wins, equal is a draw', () => {
    const moves = Array.from({ length: 50 }, () => ({
      type: 'pass' as const,
      color: 'B' as const,
    }));
    expect(captureGoStatus(withCaptures(1, 0, { moves }), rules)).toBe('won');
    expect(captureGoStatus(withCaptures(0, 1, { moves }), rules)).toBe('lost');
    expect(captureGoStatus(withCaptures(1, 1, { moves }), rules)).toBe('draw');
    const over = pass((pass(createGame(5)) as { state: GameState }).state);
    if (!over.ok) throw new Error('pass');
    expect(over.state.isOver).toBe(true);
    expect(captureGoStatus(over.state, rules)).toBe('draw');
  });
});

describe('playCaptureGo', () => {
  it('stops at once when the first move wins (G1: c4 captures c3)', () => {
    const start = createGame(5, { setup: { B: ['b3', 'c2', 'd3'], W: ['c3'] } });
    const result = playCaptureGo(
      start,
      { n: 1, player: 'B', maxMoves: 50 },
      (s) => ({ type: 'play', color: s.toPlay, point: { x: 2, y: 3 } }),
      () => {
        throw new Error('the bot must not move');
      },
    );
    expect(result).toMatchObject({ status: 'won', plies: 1 });
    expect(result.state.captures.B).toBe(1);
  });

  it('throws on an illegal move', () => {
    const start = playAt(createGame(5), 'c3');
    expect(() =>
      playCaptureGo(
        start,
        { n: 1, player: 'B', maxMoves: 10 },
        (s) => ({ type: 'play', color: s.toPlay, point: { x: 2, y: 2 } }),
        (s) => ({ type: 'play', color: s.toPlay, point: { x: 2, y: 2 } }),
      ),
    ).toThrow(/illegal/);
  });

  it('ends after maxMoves plies when both sides only pass', () => {
    const passer = (s: GameState) => ({ type: 'pass' as const, color: s.toPlay });
    const result = playCaptureGo(
      createGame(5),
      { n: 1, player: 'B', maxMoves: 50 },
      passer,
      passer,
    );
    expect(result).toMatchObject({ status: 'draw', plies: 2 }); // two passes end the game
  });
});

describe('referencePlayout', () => {
  const config: CaptureGoConfig = {
    size: 5,
    setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] },
    first: 'B',
    rules: { n: 1, player: 'B', maxMoves: 50 },
    level: 1,
    blunder: 0.5,
  };

  it('is deterministic per seed', () => {
    for (const seed of [1, 2, 3]) {
      expect(referencePlayout(config, seed)).toEqual(referencePlayout(config, seed));
    }
  });

  it('different seeds give different games', () => {
    const games = new Set(
      [1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(referencePlayout(config, s).state.moves)),
    );
    expect(games.size).toBeGreaterThan(1);
  });

  it('accepts a custom learner', () => {
    const result = referencePlayout(
      config,
      1,
      (s, rng) => chooseMove(s, { level: 1, blunder: 1, rng }).move,
    );
    expect(['won', 'lost', 'draw']).toContain(result.status);
    expect(createRng(1)()).toBeGreaterThanOrEqual(0);
  });
});
