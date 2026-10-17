// AC 13: a real position without any legal move is practically unreachable, so the engine's
// legalMoves is mocked here.
import { createGame } from '@/engine';

import { chooseMove, createRng } from './index';

jest.mock('@/engine', () => ({
  ...jest.requireActual('@/engine'),
  legalMoves: () => [],
}));

describe('chooseMove: pass (AC 13)', () => {
  it('passes with reason "pass" when legalMoves is empty, still drawing 3 numbers', () => {
    let draws = 0;
    const base = createRng(1);
    const { move, reason } = chooseMove(createGame(5, { toPlay: 'W' }), {
      level: 1,
      rng: () => {
        draws++;
        return base();
      },
    });
    expect(move).toEqual({ type: 'pass', color: 'W' });
    expect(reason).toBe('pass');
    expect(draws).toBe(3);
  });
});
