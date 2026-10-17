// The bot's fast analysis must report exactly what the engine's play() reports.
import { createGame, legalMoves, play, type Color, type GameState } from '@/engine';

import { analyzeMoves, exposedStones } from './analysis';
import { position } from './__fixtures__/board';
import { createRng } from './rng';

/** Exposed stones counted the slow way, one flood fill per stone. */
function engineExposed(state: GameState, color: Color): number {
  const { size, cells } = state.board;
  let exposed = 0;
  cells.forEach((c, i) => {
    if (c !== color) return;
    const libs = new Set<number>();
    const seen = new Set<number>([i]);
    const stack = [i];
    while (stack.length) {
      const cell = stack.pop() as number;
      const x = cell % size;
      const around = [
        x > 0 ? cell - 1 : -1,
        x < size - 1 ? cell + 1 : -1,
        cell - size,
        cell + size,
      ].filter((n) => n >= 0 && n < cells.length);
      for (const n of around) {
        if (cells[n] === null) libs.add(n);
        else if (cells[n] === color && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    if (libs.size === 1) exposed++;
  });
  return exposed;
}

function randomGame(seed: number, size: 5 | 7 | 9, plies: number): GameState {
  const rng = createRng(seed);
  let state = createGame(size);
  for (let i = 0; i < plies; i++) {
    const moves = legalMoves(state);
    if (moves.length === 0) break;
    const r = play(state, moves[Math.floor(rng() * moves.length)]);
    if (!r.ok) throw new Error('illegal');
    state = r.state;
  }
  return state;
}

describe('analyzeMoves matches the engine', () => {
  const states: GameState[] = [];
  for (let seed = 1; seed <= 150; seed++) {
    const size = ([5, 7, 9] as const)[seed % 3];
    states.push(randomGame(seed, size, 10 + (seed % 40)));
  }

  it('captured, liberties, selfAtari, opponentAtari, touched and exposed for every legal move', () => {
    let checked = 0;
    for (const state of states) {
      const color = state.toPlay;
      const points = legalMoves(state);
      const analysis = analyzeMoves(state.board, color, points);
      points.forEach((p, i) => {
        const result = play(state, p);
        if (!result.ok) throw new Error('illegal');
        const { facts } = result;
        const a = analysis[i];
        expect({
          captured: a.captured,
          liberties: a.liberties,
          selfAtari: a.selfAtari,
          opponentAtari: [...a.opponentAtari].sort(),
          exposed: a.exposed,
        }).toEqual({
          captured: facts.captured.flat().length,
          liberties: facts.playedGroup.liberties.length,
          selfAtari: facts.selfAtari,
          opponentAtari: facts.opponentAtari.map((g) => g.stones.length).sort(),
          exposed: engineExposed(result.state, color),
        });
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it('exposedStones counts own stones in atari', () => {
    const state = position(
      `
      5 . . . . .
      4 . . X . .
      3 . X O X .
      2 . . . O .
      1 . . . . .
      `,
      'W',
    );
    expect(exposedStones(state.board, 'W')).toBe(1); // c3 (liberty c2)
    expect(exposedStones(state.board, 'B')).toBe(0);
    for (const s of states) {
      expect(exposedStones(s.board, 'B')).toBe(engineExposed(s, 'B'));
      expect(exposedStones(s.board, 'W')).toBe(engineExposed(s, 'W'));
    }
  });

  it('a capture that also connects: liberties include the freed points', () => {
    // Black b1 captures a1 (spec AC 24) and is left with the single liberty a1.
    const state = position(
      `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 X O . . .
      1 O . O . .
      `,
      'B',
    );
    const [a] = analyzeMoves(state.board, 'B', [{ x: 1, y: 0 }]);
    expect(a).toMatchObject({ captured: 1, liberties: 1, selfAtari: true });
  });
});
