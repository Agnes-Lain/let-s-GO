import { createGame, legalMoves, pass, play, type GameState } from './index';

/** Plays `turns` turns on 9×9, choosing legalMoves(s)[(7·i) mod n] (spec AC 32). */
function playTurns(turns: number): { state: GameState; plays: number; passes: number } {
  let state = createGame(9);
  let plays = 0;
  let passes = 0;
  for (let i = 0; i < turns; i++) {
    if (state.isOver) state = createGame(9);
    const moves = legalMoves(state);
    if (moves.length === 0) {
      const result = pass(state);
      if (!result.ok) throw new Error(`pass refused at turn ${i}`);
      state = result.state;
      passes++;
    } else {
      const result = play(state, moves[(7 * i) % moves.length]);
      if (!result.ok) throw new Error(`legal move refused at turn ${i}: ${result.reason}`);
      state = result.state;
      plays++;
    }
  }
  return { state, plays, passes };
}

describe('performance', () => {
  it('AC 32: 1,000 turns on 9×9 with legalMoves + play take under 1 s', () => {
    playTurns(20); // warm up the JIT
    const start = performance.now();
    const { plays, passes } = playTurns(1000);
    const elapsed = performance.now() - start;
    expect(plays + passes).toBe(1000);
    expect(plays).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });

  it('AC 32: the sequence is deterministic', () => {
    expect(playTurns(300)).toEqual(playTurns(300));
  });
});
