// Spec docs/specs/M6-bot-levels.md §4.2–4.5: the 9×9 game reducer (pass ×2 → mark; Count now;
// Resign; dead-stone negotiation; Play on replays the moves minus the trailing passes; count).
import { createGame, parseVertex, pass, play, printBoard, type GameState } from '@/engine';

import {
  COUNT_NOW_MIN_MOVES,
  anyAtari,
  canCountNow,
  gameReducer,
  lossFact,
  outcomeOf,
  startSession,
  statusOf,
  type GameEvent,
  type GameSession,
} from './session';

function gameFrom(vertices: string[]): GameState {
  let game = createGame(9, { komi: 5.5 });
  for (const v of vertices) {
    const result = play(game, v);
    if (!result.ok) throw new Error(`${v}: ${result.reason}`);
    game = result.state;
  }
  return game;
}

/** Black wall on column c, White wall on column d: White owns d–j and is far ahead. */
const WALLS = Array.from({ length: 9 }, (_, i) => [`c${i + 1}`, `d${i + 1}`]).flat();

function session(vertices: string[], level: 1 | 2 | 3 = 1): GameSession {
  return { ...startSession(level, 1), game: gameFrom(vertices) };
}

const run = (s: GameSession, ...events: GameEvent[]) => events.reduce(gameReducer, s);

describe('a new game (AC 16)', () => {
  it('is an empty 9×9 board, Black (the learner) to play, komi 5.5', () => {
    const s = startSession(2, 7);
    expect(s.game.board.size).toBe(9);
    expect(s.game.board.cells.every((c) => c === null)).toBe(true);
    expect(s.game.toPlay).toBe('B');
    expect(s.game.komi).toBe(5.5);
    expect(s.learner).toBe('B');
    expect(statusOf(s)).toEqual({ key: 'game9.turn.you' });
  });
});

describe('playing (AC 16–18)', () => {
  it('a legal tap plays, then the bot answers on `bot`', () => {
    let s = run(startSession(1, 3), { type: 'play', point: parseVertex('e5', 9) });
    expect(s.thinking).toBe(true);
    expect(statusOf(s)).toEqual({ key: 'game9.turn.bot' });
    // AC 17: the board ignores taps while the bot thinks.
    expect(gameReducer(s, { type: 'play', point: parseVertex('c3', 9) })).toBe(s);
    expect(gameReducer(s, { type: 'pass' })).toBe(s);
    expect(gameReducer(s, { type: 'resign' })).toBe(s);
    s = gameReducer(s, { type: 'bot' });
    expect(s.thinking).toBe(false);
    expect(s.game.moves).toHaveLength(2);
    expect(s.game.moves[1].color).toBe('W');
  });

  it('AC 18: an illegal tap shows the engine reason and plays nothing', () => {
    const s = run(
      startSession(1, 3),
      { type: 'play', point: parseVertex('e5', 9) },
      { type: 'bot' },
    );
    const after = gameReducer(s, { type: 'play', point: parseVertex('e5', 9) });
    expect(after.note).toEqual({ key: 'game.fb.illegal.occupied' });
    expect(after.game).toBe(s.game);
  });

  it('the bot replay is deterministic for one seed', () => {
    const play1 = run(
      startSession(2, 9),
      { type: 'play', point: parseVertex('e5', 9) },
      { type: 'bot' },
    );
    const play2 = run(
      startSession(2, 9),
      { type: 'play', point: parseVertex('e5', 9) },
      { type: 'bot' },
    );
    expect(play2.game.moves).toEqual(play1.game.moves);
  });
});

describe('passing (AC 19–20)', () => {
  it('learner pass → "You passed", the bot (level 1, nothing to do) passes → mark dead stones', () => {
    let s = run(session(WALLS), { type: 'pass' });
    expect(s.note).toEqual({ key: 'game9.you.passed' });
    expect(s.thinking).toBe(true);
    s = gameReducer(s, { type: 'bot' });
    expect(s.game.isOver).toBe(true);
    expect(s.game.consecutivePasses).toBe(2);
    expect(s.phase).toBe('mark');
    expect(statusOf(s)).toEqual({ key: 'game9.mark.prompt' });
  });

  it('bot passes first: "Bot passed", the game goes on; the learner\'s pass ends it', () => {
    const s0 = session([...WALLS, 'e5']);
    const afterBotPass: GameSession = { ...s0, game: passGame(s0.game) };
    expect(statusOf(afterBotPass)).toEqual({ key: 'game9.bot.passed' });
    expect(gameReducer(afterBotPass, { type: 'pass' }).phase).toBe('mark');
  });

  it('AC 13: after the game is over a tap places nothing', () => {
    const s = run(session(WALLS), { type: 'pass' }, { type: 'bot' });
    expect(gameReducer(s, { type: 'play', point: parseVertex('a1', 9) })).toBe(s);
  });
});

/** The bot (White, to move) passes. */
function passGame(game: GameState): GameState {
  if (game.toPlay !== 'W') throw new Error('White must be to move');
  const result = pass(game);
  if (!result.ok) throw new Error('pass');
  return result.state;
}

describe('Count now (AC 21, 23)', () => {
  it('is hidden before 6 moves', () => {
    const s = session(WALLS.slice(0, COUNT_NOW_MIN_MOVES - 2));
    expect(canCountNow(s)).toBe(false);
    expect(gameReducer(s, { type: 'countNow' })).toBe(s);
    expect(canCountNow(session(WALLS.slice(0, COUNT_NOW_MIN_MOVES)))).toBe(true);
  });

  it('plays the learner pass and a forced bot pass, then opens the marking', () => {
    const s = run(session(WALLS, 3), { type: 'countNow' });
    expect(s.phase).toBe('mark');
    expect(s.game.moves.slice(-2)).toEqual([
      { type: 'pass', color: 'B' },
      { type: 'pass', color: 'W' },
    ]);
  });

  it('anyAtari spots a group in atari (the sheet adds a line)', () => {
    expect(anyAtari(gameFrom(WALLS))).toBe(false);
    expect(anyAtari(gameFrom([...WALLS, 'a5', 'b5', 'b4']))).toBe(true);
  });
});

describe('Resign (AC 22, 33)', () => {
  it('ends at once with "You resigned"; Show the count is hypothetical; Done goes back', () => {
    let s = run(session(WALLS), { type: 'resign' });
    expect(s.phase).toBe('result');
    expect(outcomeOf(s)).toBe('resigned');
    expect(statusOf(s)).toEqual({ key: 'game9.result.resigned' });
    s = gameReducer(s, { type: 'showCount' });
    expect(s.phase).toBe('count');
    expect(s.count?.hypothetical).toBe(true);
    expect(s.count?.score.white.total).toBe(54 + 5.5);
    s = gameReducer(s, { type: 'countDone' });
    expect(s.phase).toBe('result');
    expect(outcomeOf(s)).toBe('resigned');
  });
});

describe('marking dead stones (AC 25–32)', () => {
  const marking = () => run(session(WALLS), { type: 'countNow' });

  it('AC 25: a tap toggles a whole group', () => {
    let s = gameReducer(marking(), { type: 'mark', at: 'c5' });
    expect(s.marks).toHaveLength(9);
    s = gameReducer(s, { type: 'mark', at: 'c1' });
    expect(s.marks).toEqual([]);
    s = run(s, { type: 'mark', at: 'c1' }, { type: 'clearMarks' });
    expect(s.marks).toEqual([]);
  });

  it('AC 27, 30: no marks on a settled board → "Agreed." and the count (White wins by 32.5)', () => {
    const s = gameReducer(marking(), { type: 'markDone' });
    expect(s.phase).toBe('count');
    expect(s.note).toEqual({ key: 'game9.mark.agreed' });
    expect(s.count?.score.black.total).toBe(27);
    expect(statusOf(s)).toEqual({ key: 'game9.result.whiteWins', params: { margin: 32.5 } });
    const done = gameReducer(s, { type: 'countDone' });
    expect(outcomeOf(done)).toBe('loss');
    expect(lossFact(done)).toEqual({
      key: 'game9.result.fact.land',
      params: { white: 59.5, black: 27 },
    });
  });

  it('AC 28: marking an alive group → the bot states a fact, removes the mark, stays', () => {
    const s = run(marking(), { type: 'mark', at: 'c5' }, { type: 'markDone' });
    expect(s.phase).toBe('mark');
    expect(s.marks).toEqual([]);
    expect(s.flash).toHaveLength(9);
    expect(s.note).toEqual({
      key: 'game9.dispute.liberties',
      params: { point: 'c1', count: 9 },
    });
  });

  const withDeadStone = [...WALLS, 'a5', 'b5', 'b4', 'h8'];

  it('AC 29: the bot proposes a proved-dead group; Accept adds it and counts', () => {
    let s = run(session(withDeadStone), { type: 'countNow' }, { type: 'markDone' });
    expect(s.dispute).toEqual({ points: ['b5'] });
    expect(s.note).toEqual({ key: 'game9.dispute.propose', params: { points: 'b5' } });
    expect(gameReducer(s, { type: 'mark', at: 'c1' })).toBe(s);
    s = gameReducer(s, { type: 'accept' });
    expect(s.phase).toBe('count');
    expect(s.count?.dead).toEqual(['b5']);
  });

  it('AC 31–32: Play on replays the moves minus the passes, learner to move', () => {
    const before = gameFrom(withDeadStone);
    let s = run(
      session(withDeadStone),
      { type: 'countNow' },
      { type: 'markDone' },
      { type: 'playOn' },
    );
    expect(s.phase).toBe('playing');
    expect(s.game.moves).toEqual(before.moves);
    expect(printBoard(s.game.board)).toBe(printBoard(before.board));
    expect(s.game.toPlay).toBe('B');
    expect(s.game.consecutivePasses).toBe(0);
    expect(s.note).toEqual({ key: 'game9.dispute.playOn.status' });
    s = run(s, { type: 'countNow' }, { type: 'markDone' }, { type: 'playOn' });
    expect(s.playOnRounds).toBe(2);
    expect(s.note).toEqual({ key: 'game9.dispute.captureHint' });
  });

  it('Play on after the bot passed first keeps its pass (the learner is to move)', () => {
    const s0 = session([...WALLS, 'e5']);
    const s: GameSession = { ...s0, game: passGame(s0.game) };
    const marked = gameReducer(s, { type: 'pass' });
    expect(marked.phase).toBe('mark');
    const resumed = gameReducer(marked, { type: 'playOn' });
    expect(resumed.game.toPlay).toBe('B');
    expect(resumed.game.consecutivePasses).toBe(1);
  });
});

describe('result (AC 34)', () => {
  it('a won count is a win', () => {
    // Black wall on column f: Black owns a–f (54) against White's g–j (27 + 5.5).
    const walls = Array.from({ length: 9 }, (_, i) => [`f${i + 1}`, `g${i + 1}`]).flat();
    const s = run(
      session(walls),
      { type: 'countNow' },
      { type: 'markDone' },
      { type: 'countDone' },
    );
    expect(outcomeOf(s)).toBe('win');
    expect(statusOf(s)).toEqual({ key: 'game9.result.win' });
    expect(lossFact(s)).toBeNull();
  });

  it('komi decided it: a lead without komi is named', () => {
    const s0 = run(
      session(WALLS),
      { type: 'countNow' },
      { type: 'markDone' },
      { type: 'countDone' },
    );
    const score = s0.result?.kind === 'count' ? s0.result.score : null;
    if (!score) throw new Error('no score');
    const close = {
      ...s0,
      result: {
        ...s0.result,
        kind: 'count' as const,
        winner: 'W' as const,
        margin: 2.5,
        score: {
          ...score,
          black: { ...score.black, total: 42 },
          white: { ...score.white, total: 44.5, komi: 5.5 },
        },
      },
    };
    expect(lossFact(close)).toEqual({ key: 'game9.result.fact.komi', params: { margin: 3 } });
  });
});
