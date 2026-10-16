import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  checkMove,
  createGame,
  legalMoves,
  parseBoard,
  pass,
  play,
  score,
  type GameState,
} from './index';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** A mid-game position with a ko point, captures and history. */
function koPosition(): GameState {
  const start = createGame(5, {
    setup: { B: ['c4', 'b3', 'c2'], W: ['d4', 'c3', 'e3', 'd2'] },
    toPlay: 'B',
  });
  const result = play(start, 'd3'); // captures c3, ko at c3
  if (!result.ok) throw new Error('setup move should be legal');
  return result.state;
}

describe('purity', () => {
  it('AC 24: play, pass, checkMove, legalMoves and score never change a deep-frozen state', () => {
    const state = deepFreeze(koPosition());
    const copy = JSON.parse(JSON.stringify(state));

    expect(() => {
      play(state, 'a1'); // legal
      play(state, 'c3'); // ko
      play(state, 'd3'); // occupied
      play(state, { x: 9, y: 9 }); // off-board
      pass(state);
      checkMove(state, 'a1');
      checkMove(state, 'c3');
      legalMoves(state);
      score(state.board, { komi: state.komi });
    }).not.toThrow();
    expect(state).toEqual(copy);
  });

  it('AC 24: score never changes a deep-frozen board or dead-stone list', () => {
    const { board } = parseBoard(`
      5 . . X O .
      4 o . X O .
      3 . . X . O
      2 . . X O .
      1 . . X O .
        a b c d e
    `);
    const state = deepFreeze({ ...koPosition(), board });
    const deadStones = deepFreeze(['a4', { x: 0, y: 3 }]);
    const copy = JSON.parse(JSON.stringify({ state, deadStones }));

    let first: ReturnType<typeof score> | undefined;
    expect(() => {
      first = score(state.board, { komi: state.komi, deadStones });
      score(state.board, { komi: 7.5 });
    }).not.toThrow();
    expect({ state, deadStones }).toEqual(copy);
    expect(score(state.board, { komi: state.komi, deadStones })).toEqual(first);
  });

  it('AC 24: a capture from a deep-frozen state does not change it', () => {
    const state = deepFreeze(
      createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' }),
    );
    const copy = JSON.parse(JSON.stringify(state));
    const result = play(state, 'c4');
    expect(result.ok).toBe(true);
    expect(state).toEqual(copy);
  });

  it('AC 24: the same input gives deep-equal results', () => {
    const state = deepFreeze(koPosition());
    expect(play(state, 'a1')).toEqual(play(state, 'a1'));
    expect(play(state, 'c3')).toEqual(play(state, 'c3'));
    expect(pass(state)).toEqual(pass(state));
    expect(legalMoves(state)).toEqual(legalMoves(state));
    expect(score(state.board, { komi: 0.5 })).toEqual(score(state.board, { komi: 0.5 }));
  });

  it('AC 24: results share no mutable arrays with the input', () => {
    const state = koPosition();
    const result = play(state, 'a1');
    if (!result.ok) throw new Error('a1 should be legal');
    expect(result.state.board.cells).not.toBe(state.board.cells);
    expect(result.state.moves).not.toBe(state.moves);
    expect(result.state.moves).toHaveLength(state.moves.length + 1);
  });

  it('AC 25: engine sources use no React/RN/Expo, randomness, clock or timers', () => {
    const dir = __dirname;
    const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(sources.length).toBeGreaterThan(0);
    const forbidden = [
      /from ['"](react|react-native|expo)[^'"]*['"]/,
      /\bMath\.random\b/,
      /\bDate\b/,
      /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/,
      /\bperformance\.now\b/,
    ];
    for (const file of sources) {
      const code = readFileSync(join(dir, file), 'utf8');
      for (const pattern of forbidden) {
        expect({ file, match: pattern.exec(code)?.[0] ?? null }).toEqual({ file, match: null });
      }
    }
  });
});
