// Spec docs/specs/M6b-13x13-bot-tuning.md §4.7 (AC 33–34): the 13×13 ply cap in a session.
import { MAX_PLIES_13 } from '@/bot';
import { parseVertex } from '@/engine';

import { gameReducer, startSession, type GameEvent, type GameSession } from './session';

const run = (s: GameSession, ...events: GameEvent[]) => events.reduce(gameReducer, s);
const at = (v: string): GameEvent => ({ type: 'play', point: parseVertex(v, 13) });
const BOT: GameEvent = { type: 'bot' };

/** A 13×13 Normal session whose move list is padded to `plies` (the learner, Black, to move). */
function atPly(plies: number): GameSession {
  const s = run(startSession(2, 1, 0, true, 13), at('g7'), BOT);
  const filler = s.game.moves[0];
  return { ...s, game: { ...s.game, moves: Array.from({ length: plies }, () => filler) } };
}

describe('AC 33: at the 13×13 cap the bot passes and the game can be counted', () => {
  it('ply 400: the bot passes; the learner passes too and the game goes to counting', () => {
    let s = run(atPly(MAX_PLIES_13 - 1), at('c3'));
    expect(s.game.moves).toHaveLength(MAX_PLIES_13);
    s = run(s, BOT);
    expect(s.game.moves.at(-1)).toMatchObject({ type: 'pass', color: 'W' });
    s = run(s, { type: 'pass' });
    expect(s.game.isOver).toBe(true);
    expect(s.phase).not.toBe('playing');
  });
});

describe('AC 34: take-back never moves the ply count past the cap', () => {
  // Playing on after the cap is possible (the bot answers with passes, as on 9×9 at 200); a
  // take-back only restores an earlier, shorter position.
  it('after the cap, a take-back returns to the position after the bot’s pass', () => {
    let s = run(atPly(MAX_PLIES_13 - 1), at('c3'), BOT, at('e3'), BOT);
    const plies = s.game.moves.length;
    expect(plies).toBe(MAX_PLIES_13 + 3);
    expect(s.game.moves.at(-1)).toMatchObject({ type: 'pass', color: 'W' });
    s = run(s, { type: 'takeback' });
    expect(s.game.moves.length).toBe(MAX_PLIES_13 + 1);
    expect(s.game.moves.at(-1)).toMatchObject({ type: 'pass', color: 'W' });
  });
});
