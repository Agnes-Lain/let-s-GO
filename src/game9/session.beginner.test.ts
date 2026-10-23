// Spec docs/specs/M6-beginner-friendly.md §4.1 (AC 2–6) and §4.2 (AC 15–25): handicap games and
// take-back 悔棋 in the session reducer.
import { parseVertex, play, printBoard, score, toVertex, type GameState } from '@/engine';

import { playAt, position } from '@/bot/__fixtures__/board';

import { dangerOf } from './danger';
import {
  canTakeBack,
  gameReducer,
  startSession,
  type GameEvent,
  type GameSession,
} from './session';

const run = (s: GameSession, ...events: GameEvent[]) => events.reduce(gameReducer, s);
const at = (v: string): GameEvent => ({ type: 'play', point: parseVertex(v, 9) });
const BOT: GameEvent = { type: 'bot' };
const TAKEBACK: GameEvent = { type: 'takeback' };
const blackAt = (game: GameState) =>
  game.board.cells
    .map((c, i) => (c === 'B' ? toVertex({ x: i % 9, y: Math.floor(i / 9) }, 9) : null))
    .filter(Boolean)
    .sort();

function sessionAt(game: GameState, level: 1 | 2 | 3 = 1): GameSession {
  return { ...startSession(level, 1), game };
}

describe('handicap games (AC 2, 3, 5, 6)', () => {
  it('AC 2: 4 stones, White to move first, komi 0.5, the bot thinking', () => {
    const s = startSession(2, 7, 4);
    expect(blackAt(s.game)).toEqual(['c3', 'c7', 'g3', 'g7']);
    expect(s.game.board.cells.filter((c) => c === 'W')).toHaveLength(0);
    expect(s.game.toPlay).toBe('W');
    expect(s.game.komi).toBe(0.5);
    expect(s.game.moves).toEqual([]);
    expect(s.handicap).toBe(4);
    expect(s.thinking).toBe(true);
    // AC 4: buttons locked = the reducer ignores the learner while the bot thinks.
    expect(gameReducer(s, { type: 'pass' })).toBe(s);
    expect(gameReducer(s, TAKEBACK)).toBe(s);
    expect(canTakeBack(s)).toBe(false);
    const after = gameReducer(s, BOT);
    expect(after.thinking).toBe(false);
    expect(after.game.moves).toHaveLength(1);
    expect(after.game.moves[0].color).toBe('W');
    expect(after.game.toPlay).toBe('B');
  });

  it('AC 3: no handicap is the old even game', () => {
    const s = startSession(1, 7, 0);
    expect(s.game.board.cells.every((c) => c === null)).toBe(true);
    expect(s.game.toPlay).toBe('B');
    expect(s.game.komi).toBe(5.5);
    expect(s.thinking).toBe(false);
    expect(startSession(1, 7)).toEqual(s);
  });

  it('`new` keeps the handicap unless another is given (Play again, AC 12)', () => {
    const s = startSession(1, 7, 3);
    expect(gameReducer(s, { type: 'new', seed: 2 }).handicap).toBe(3);
    const even = gameReducer(s, { type: 'new', seed: 2, handicap: 0 });
    expect(even.handicap).toBe(0);
    expect(even.game.komi).toBe(5.5);
  });

  it('AC 5: Play on after two passes keeps the 3 handicap stones, komi 0.5, the learner to move', () => {
    let s = run(startSession(1, 3, 3), BOT, at('e5'), BOT);
    const stonesBefore = printBoard(s.game.board);
    s = run(s, { type: 'pass' });
    if (s.phase === 'playing') s = gameReducer(s, BOT);
    if (s.phase === 'playing') s = gameReducer(s, { type: 'pass' });
    expect(s.phase).toBe('mark');
    s = gameReducer(s, { type: 'playOn' });
    expect(s.phase).toBe('playing');
    expect(s.game.komi).toBe(0.5);
    expect(s.game.toPlay).toBe('B');
    for (const v of ['c3', 'g7', 'g3']) {
      expect(s.game.board.cells[parseVertex(v, 9).y * 9 + parseVertex(v, 9).x]).toBe('B');
    }
    // The stones on the board are those before the passes (the bot's pass may stand).
    expect(printBoard(s.game.board)).toBe(stonesBefore);
  });

  it('AC 6: the count counts the handicap stones as Black stones, komi 0.5 for White', () => {
    // Count now needs 6 moves: play a few first.
    let s = run(startSession(1, 5, 4), BOT, at('e5'), BOT, at('d5'), BOT, at('e4'), BOT);
    s = run(s, { type: 'countNow' }, { type: 'markDone' });
    if (s.dispute) s = gameReducer(s, { type: 'accept' });
    expect(s.phase).toBe('count');
    const counted = s.count?.score;
    const direct = score(s.game.board, { komi: 0.5, deadStones: s.count?.dead ?? [] });
    expect(counted).toEqual(direct);
    expect(counted?.white.komi).toBe(0.5);
    expect(counted?.black.total).toBe(
      (counted?.black.stones ?? 0) + (counted?.black.territory ?? 0),
    );
  });
});

/** Black wall on column c, White wall on column b: Black owns c–j and is far ahead. */
const BLACK_AHEAD = position(
  Array.from({ length: 9 }, (_, i) => `${9 - i} . O X . . . . . .`).join('\n'),
  'B',
);

describe('take-back 悔棋 (AC 15–25)', () => {
  it('AC 15: undoes the learner move and the reply; the last marker is the one before', () => {
    let s = run(startSession(1, 4), at('c3'), BOT);
    const before = s;
    s = run(s, at('e5'), BOT);
    expect(canTakeBack(s)).toBe(true);
    const back = gameReducer(s, TAKEBACK);
    expect(back.game).toBe(before.game);
    expect(back.thinking).toBe(false);
    expect(back.last?.point).toEqual(before.last?.point);
    expect(back.last?.color).toBe(before.last?.color);
    expect(back.note).toEqual({ key: 'game9.takeback.done' });
    expect(gameReducer(s, { type: 'takeback', first: true }).note).toEqual({
      key: 'game9.takeback.first',
    });
  });

  it('AC 16: a capture is undone with its counters', () => {
    const game = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . X . . . .
      5 . . . X O X . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    let s = run(sessionAt(game), at('e4'));
    expect(s.game.captures.B).toBe(1);
    s = run(s, BOT, TAKEBACK);
    expect(s.game).toBe(game);
    expect(s.game.captures.B).toBe(0);
    expect(s.game.board.cells[parseVertex('e5', 9).y * 9 + 4]).toBe('W');
  });

  it("AC 17: a ko capture is undone with the position's own ko point", () => {
    // White just took a ko at e5: Black may not retake at d5 now (koPoint d5).
    const start = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . O X . . . .
      5 . . O X . X . . .
      4 . . . O X . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'W',
    );
    const ko = playAt(start, 'e5');
    expect(ko.koPoint).toEqual(parseVertex('d5', 9));
    let s = run(sessionAt(ko), at('j9'), BOT);
    s = gameReducer(s, TAKEBACK);
    expect(s.game).toBe(ko);
    expect(s.game.koPoint).toEqual(parseVertex('d5', 9));
    expect(gameReducer(s, at('d5')).note).toEqual({ key: 'game.fb.illegal.ko' });

    // Black takes a ko (koPoint for White = d5) and takes it back: no ko point before.
    const black = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . X O . . . .
      5 . . X O . O . . .
      4 . . . X O . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    s = run(sessionAt(black), at('e5'));
    expect(s.game.koPoint).toEqual(parseVertex('d5', 9));
    s = run(s, BOT, TAKEBACK);
    expect(s.game).toBe(black);
    expect(s.game.koPoint).toBeNull();
  });

  it('AC 18: a pass and the reply are both undone', () => {
    // Black (the learner) far ahead: Normal does not pass back.
    let s = sessionAt(BLACK_AHEAD, 2);
    const before = s.game;
    s = run(s, { type: 'pass' });
    s = gameReducer(s, BOT);
    expect(s.phase).toBe('playing');
    s = gameReducer(s, TAKEBACK);
    expect(s.game).toBe(before);
    expect(s.game.toPlay).toBe('B');
  });

  it('AC 19: ignored while thinking, outside playing, or with an empty history', () => {
    const fresh = startSession(1, 4);
    expect(gameReducer(fresh, TAKEBACK)).toBe(fresh);
    const thinking = gameReducer(fresh, at('e5'));
    expect(gameReducer(thinking, TAKEBACK)).toBe(thinking);
    const marking = { ...run(thinking, BOT), phase: 'mark' as const };
    expect(gameReducer(marking, TAKEBACK)).toBe(marking);
    for (const phase of ['count', 'result'] as const) {
      const other = { ...run(thinking, BOT), phase };
      expect(gameReducer(other, TAKEBACK)).toBe(other);
    }
  });

  it('AC 20–21: Normal has 3, Challenge 1, Easy unlimited', () => {
    expect(startSession(1, 1).takebacksLeft).toBeNull();
    expect(startSession(2, 1).takebacksLeft).toBe(3);
    expect(startSession(3, 1).takebacksLeft).toBe(1);
    let s = startSession(2, 4);
    const cycle = () => (s = run(s, at('e5'), BOT, TAKEBACK));
    cycle();
    expect(s.takebacksLeft).toBe(2);
    cycle();
    cycle();
    expect(s.takebacksLeft).toBe(0);
    s = run(s, at('e5'), BOT);
    expect(canTakeBack(s)).toBe(false);
    expect(gameReducer(s, TAKEBACK)).toBe(s);

    let easy = startSession(1, 4);
    for (let i = 0; i < 5; i++) easy = run(easy, at('e5'), BOT, TAKEBACK);
    expect(easy.takebacksLeft).toBeNull();
    expect(easy.game.moves).toHaveLength(0);
  });

  it('AC 22–23: Play on empties the history; the used count stays used', () => {
    let s = run(startSession(2, 4), at('e5'), BOT, TAKEBACK, at('e5'), BOT);
    for (const v of ['c3', 'g7', 'c7']) s = run(s, at(v), BOT);
    expect(s.history.length).toBeGreaterThan(0);
    s = run(s, { type: 'countNow' });
    expect(s.phase).toBe('mark');
    s = gameReducer(s, { type: 'playOn' });
    expect(s.history).toEqual([]);
    expect(s.takebacksLeft).toBe(2);
    expect(gameReducer(s, TAKEBACK)).toBe(s);
    const resigned = run(startSession(1, 4), at('e5'), BOT, { type: 'resign' });
    expect(gameReducer(resigned, TAKEBACK)).toBe(resigned);
  });

  it('AC 24: `new` resets the history and the allowance', () => {
    const s = run(startSession(3, 4), at('e5'), BOT, TAKEBACK, at('e5'), BOT, {
      type: 'new',
      seed: 9,
    });
    expect(s.history).toEqual([]);
    expect(s.takebacksLeft).toBe(1);
  });

  it('AC 25: the taken-back position has its own danger; the same move gets the same reply', () => {
    const s = run(startSession(2, 6), at('e5'), BOT);
    const again = run(s, TAKEBACK, at('e5'), BOT);
    expect(again.game.moves).toEqual(s.game.moves);
    const back = gameReducer(s, TAKEBACK);
    expect(dangerOf(back.game)).toEqual(dangerOf(startSession(2, 6).game));
  });

  it('the history holds one snapshot per learner action', () => {
    const s = run(sessionAt(BLACK_AHEAD, 2), { type: 'pass' }, BOT, at('j9'), BOT);
    expect(s.phase).toBe('playing');
    expect(s.history).toHaveLength(2);
    expect(s.history[0].game).toBe(BLACK_AHEAD);
    expect(s.history[1].game.moves).toHaveLength(2);
    expect(play(s.history[1].game, 'j9').ok).toBe(true);
  });
});

describe('QA: AC 34 — the illegal-move reason clears on the next touch-down', () => {
  it('touch clears an illegal note (and only that kind of note)', () => {
    const s = run(startSession(1, 4), at('e5'), BOT);
    const illegal = gameReducer(s, at('e5'));
    expect(illegal.note).toEqual({ key: 'game.fb.illegal.occupied' });
    expect(gameReducer(illegal, { type: 'touch' }).note).toBeNull();
    const back = gameReducer(run(s, at('c3'), BOT), TAKEBACK);
    expect(gameReducer(back, { type: 'touch' }).note).toEqual(back.note);
  });
});
