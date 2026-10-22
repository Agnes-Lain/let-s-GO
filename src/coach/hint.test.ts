// Spec docs/specs/M6-game-coaching.md §4.3 (AC 17, 21–23): the 提示 hint.
import {
  checkMove,
  createGame,
  legalMoves,
  parseVertex,
  play,
  toVertex,
  type GameState,
} from '@/engine';

import { createRng } from '@/bot';
import { position } from '@/bot/__fixtures__/board';

import { HINTS_PER_GAME, hintCategory, hintFor, hintNote } from './hint';

const at = (v: string) => parseVertex(v, 9);

describe('hintFor (AC 17, 21, 22)', () => {
  it('per-game hints: Easy 3, Normal 2, Challenge 1', () => {
    expect(HINTS_PER_GAME).toEqual({ 1: 3, 2: 2, 3: 1 });
  });

  it('capture: Black e5 takes White d5 (fixture A)', () => {
    const state = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . X . . . . .
      5 . . X O . . . . .
      4 . . . X . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    const hint = hintFor(state);
    expect(hint).toEqual({ point: at('e5'), category: 'capture', count: 1 });
    expect(hintNote(hint)).toEqual({ key: 'coach.hint.capture', params: { count: 1 } });
  });

  it('save: Black d5 in atari extends at d6 (fixture D)', () => {
    const state = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . O X O . . . .
      4 . . . O . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    expect(hintFor(state)).toEqual({ point: at('d6'), category: 'save' });
    expect(hintNote(hintFor(state))).toEqual({ key: 'coach.hint.save' });
  });

  it('territory: the empty board', () => {
    const hint = hintFor(createGame(9, { komi: 5.5 }));
    expect(hint.category).toBe('territory');
    expect(hint.point).not.toBeNull();
    expect(hintNote(hint)).toEqual({ key: 'coach.hint.territory' });
  });

  it('AC 22: nothing to play (only own eyes) -> no point, the "nothing urgent" line', () => {
    const state = position(
      `
      . X X X X
      X X X X X
      X X . X X
      X X X X X
      X X X X .
      `,
      'B',
    );
    const hint = hintFor(state);
    expect(hint).toEqual({ point: null, category: 'pass' });
    expect(hintNote(hint)).toEqual({ key: 'coach.hint.pass' });
  });
});

describe('hintCategory (AC 21)', () => {
  it('atari: counts the white stones put in atari', () => {
    // White e5 e6 have liberties e4 and e7; Black e7 leaves e4.
    const state = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . X O X . . .
      5 . . . X O X . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    expect(hintCategory(state, at('e7'), 'atari')).toEqual({ category: 'atari', count: 2 });
    expect(hintNote({ point: at('e7'), category: 'atari', count: 2 })).toEqual({
      key: 'coach.hint.atari',
      params: { count: 2 },
    });
  });

  it('liberties: a quiet move that gives a 2-liberty group more room', () => {
    // Black c3 c4 has liberties c2 and d4 (White b3 b4 c5 d3); d4 gives it more.
    const state = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . O . . . . . .
      4 . O X . . . . . .
      3 . O X O . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    expect(hintCategory(state, at('d4'), 'pressure')).toEqual({ category: 'liberties' });
    expect(hintNote({ point: at('d4'), category: 'liberties' })).toEqual({
      key: 'coach.hint.liberties',
    });
    // Far away: nothing for a weak group -> territory.
    expect(hintCategory(state, at('g7'), 'random')).toEqual({ category: 'territory' });
  });
});

describe('hint stability (AC 23)', () => {
  /** Random 9×9 positions (seeded), 0–70 plies of random legal moves. */
  function randomPositions(n: number): GameState[] {
    const rng = createRng(2026);
    const out: GameState[] = [];
    for (let i = 0; i < n; i++) {
      let state = createGame(9, { komi: 5.5 });
      const plies = Math.floor(rng() * 70);
      for (let k = 0; k < plies; k++) {
        const moves = legalMoves(state);
        if (moves.length === 0) break;
        const result = play(state, moves[Math.floor(rng() * moves.length)]);
        if (result.ok) state = result.state;
      }
      out.push(state);
    }
    return out;
  }

  it('the same position gives the same hint 20 times', () => {
    const [state] = randomPositions(1);
    const first = hintFor(state);
    for (let i = 0; i < 20; i++) expect(hintFor(state)).toEqual(first);
  });

  it('the hinted move is always legal (100 random positions)', () => {
    for (const state of randomPositions(100)) {
      const hint = hintFor(state);
      if (hint.point === null) continue;
      expect({ at: toVertex(hint.point, 9), check: checkMove(state, hint.point) }).toEqual({
        at: toVertex(hint.point, 9),
        check: { legal: true },
      });
    }
  });
});
