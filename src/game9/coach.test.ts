// Spec docs/specs/M6-game-coaching.md §4.2–4.3 in the game reducer: the notes (AC 10–14) and the
// 提示 hint (AC 17–20, 22, 24).
import { parseVertex, type GameState } from '@/engine';

import { position } from '@/bot/__fixtures__/board';

import { gameReducer, outcomeOf, startSession, type GameEvent, type GameSession } from './session';

const run = (s: GameSession, ...events: GameEvent[]) => events.reduce(gameReducer, s);
const at = (v: string) => ({ type: 'play' as const, point: parseVertex(v, 9) });

function sessionAt(game: GameState, level: 1 | 2 | 3 = 2): GameSession {
  return { ...startSession(level, 1), game };
}

// Black a1 is in atari (liberty a2); White d5 is in atari (liberty e5).
const BOARD = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . X . . . . .
  5 . . X O . . . . .
  4 . . . X . . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 X O . . . . . . .
  `,
  'B',
);

describe('notes (AC 10–14)', () => {
  it('a new game has no notes and the per-level hints', () => {
    expect(startSession(1, 1).coach).toEqual({
      notes: [],
      hint: null,
      hintsLeft: null,
      hintsUsed: 0,
    });
    expect(startSession(2, 1).coach.hintsLeft).toBeNull();
    expect(startSession(3, 1).coach.hintsLeft).toBe(3);
  });

  it("AC 12: line 1 appears at commit, before the bot's move", () => {
    const s = run(sessionAt(BOARD), at('e5'));
    expect(s.thinking).toBe(true);
    expect(s.coach.notes).toEqual([{ key: 'coach.you.capture', params: { count: 1 } }]);
    expect(s.note).toBeNull();
  });

  it('AC 11/13: the bot reply adds line 2; its capture beats everything', () => {
    const s = run(sessionAt(BOARD), at('e5'), { type: 'bot' });
    expect(s.game.moves[1]).toMatchObject({ type: 'play', point: parseVertex('a2', 9) });
    expect(s.coach.notes).toEqual([
      { key: 'coach.you.capture', params: { count: 1 } },
      { key: 'coach.bot.capture', params: { count: 1 } },
    ]);
  });

  it('AC 10: a quiet ply makes no line', () => {
    const s = run(sessionAt(BOARD), at('g7'));
    expect(s.coach.notes).toEqual([]);
  });

  it('AC 12: the notes clear on the next touch (learner to move), a pass, or a new game', () => {
    const s = run(sessionAt(BOARD), at('e5'), { type: 'bot' });
    expect(gameReducer(s, { type: 'touch' }).coach.notes).toEqual([]);
    expect(gameReducer(s, { type: 'pass' }).coach.notes).toEqual([]);
    expect(gameReducer(s, { type: 'new', seed: 2 }).coach.notes).toEqual([]);
    // While the bot thinks, a touch keeps line 1 (line 2 is still to come).
    const thinking = run(sessionAt(BOARD), at('e5'));
    expect(gameReducer(thinking, { type: 'touch' })).toBe(thinking);
  });

  it('AC 14: a self-atari is a calm note; the move is played', () => {
    const board = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . O . . . . . . .
      `,
      'B',
    );
    const s = run(sessionAt(board), at('a1'));
    expect(s.game.moves).toHaveLength(1);
    expect(s.coach.notes).toEqual([
      { key: 'coach.you.selfAtari', params: { count: 1, point: 'A1' } },
    ]);
  });
});

describe('hint (AC 17–20, 22, 24)', () => {
  it('AC 17: shows the best move with its reason and uses one hint', () => {
    const s = run(sessionAt(BOARD, 3), { type: 'hint' });
    expect(s.coach.hint).toEqual({
      point: parseVertex('e5', 9),
      note: { key: 'coach.hint.capture', params: { count: 1 } },
    });
    expect(s.coach.hintsLeft).toBe(2);
    expect(s.coach.hintsUsed).toBe(1);
  });

  it('AC 17: Easy and Normal have no limit; hints used still counts', () => {
    for (const level of [1, 2] as const) {
      let s = sessionAt(BOARD, level);
      for (let i = 0; i < 5; i += 1) {
        s = gameReducer(s, { type: 'hint' });
        expect(s.coach.hint).not.toBeNull();
        s = { ...s, coach: { ...s.coach, hint: null } };
      }
      expect(s.coach.hintsLeft).toBeNull();
      expect(s.coach.hintsUsed).toBe(5);
    }
  });

  it('AC 18: tapping Hint again changes nothing', () => {
    const s = run(sessionAt(BOARD), { type: 'hint' });
    expect(gameReducer(s, { type: 'hint' })).toBe(s);
  });

  it('AC 19: any move or a pass removes the marker; the learner may ignore it', () => {
    const s = run(sessionAt(BOARD), { type: 'hint' });
    expect(gameReducer(s, at('g7')).coach.hint).toBeNull();
    expect(gameReducer(s, at('e5')).coach.hint).toBeNull();
    expect(gameReducer(s, { type: 'pass' }).coach.hint).toBeNull();
  });

  it('AC 20: no hint with 0 left, while the bot thinks, or outside play', () => {
    const none = { ...sessionAt(BOARD, 3), coach: { ...sessionAt(BOARD, 3).coach, hintsLeft: 0 } };
    expect(gameReducer(none, { type: 'hint' })).toBe(none);
    const thinking = run(sessionAt(BOARD), at('g7'));
    expect(gameReducer(thinking, { type: 'hint' })).toBe(thinking);
    const resigned = run(sessionAt(BOARD), { type: 'resign' });
    expect(gameReducer(resigned, { type: 'hint' })).toBe(resigned);
  });

  it('AC 22: "nothing urgent" uses no hint', () => {
    const full = position(
      `
      9 . X X X X X X X X
      8 X X X X X X X X X
      7 X X . X X X X X X
      6 X X X X X X X X X
      5 X X X X . X X X X
      4 X X X X X X X X X
      3 X X X X X X . X X
      2 X X X X X X X X X
      1 X X X X X X X X .
      `,
      'B',
    );
    const s = run(sessionAt(full, 3), { type: 'hint' });
    expect(s.coach.hint).toEqual({ point: null, note: { key: 'coach.hint.pass' } });
    expect(s.coach.hintsLeft).toBe(3);
    expect(s.coach.hintsUsed).toBe(0);
  });

  it('AC 24: hints do not change the result', () => {
    const s = run(sessionAt(BOARD), { type: 'hint' }, { type: 'resign' });
    expect(outcomeOf(s)).toBe('resigned');
    expect(s.coach.hintsUsed).toBe(1);
  });

  it('a new game resets the hints', () => {
    const s = run(sessionAt(BOARD, 3), { type: 'hint' }, { type: 'new', seed: 3 });
    expect(s.coach).toEqual({ notes: [], hint: null, hintsLeft: 3, hintsUsed: 0 });
  });
});
