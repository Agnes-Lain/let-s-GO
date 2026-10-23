// Spec docs/specs/M6-beginner-friendly.md AC 44 in the reducer: the bot (mocked to play a given
// point) puts the learner's D4 in atari (§5.3 diagram A after White's D5); the coaching note that
// repeats the atari line is dropped, other notes stay.
import { parseVertex } from '@/engine';

import { position } from '@/bot/__fixtures__/board';

import { atariLine, dangerOf } from './danger';
import { gameReducer, startSession, type GameSession } from './session';

let mockBotPoint = 'd5';
jest.mock('@/bot', () => {
  const actual = jest.requireActual('@/bot');
  return {
    ...actual,
    chooseMove: (state: { toPlay: 'B' | 'W' }) => ({
      move: {
        type: 'play',
        color: state.toPlay,
        point: jest.requireActual('@/engine').parseVertex(mockBotPoint, 9),
      },
      reason: 'atari',
    }),
  };
});

const BEFORE_D5 = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . . . . . . .
  5 . . . . . . . . .
  4 . . O X O . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'B',
);

const session = (): GameSession => ({ ...startSession(2, 1), game: BEFORE_D5 });

describe('AC 44: coaching dedupe against the atari line', () => {
  it("White's D5 ataris D4: no coach note about D4, the atari line names D4 / D3", () => {
    mockBotPoint = 'd5';
    let s = gameReducer(session(), { type: 'play', point: parseVertex('j9', 9) });
    s = gameReducer(s, { type: 'bot' });
    expect(s.coach.notes.map((n) => n.key)).not.toContain('coach.you.exposed');
    expect(s.coach.notes.map((n) => n.key)).not.toContain('coach.bot.atari');
    expect(atariLine(dangerOf(s.game), 'B')?.note).toEqual({
      key: 'game9.atari.you.one',
      params: { where: 'D4', lib: 'D3' },
    });
  });

  it("the learner's capture elsewhere still shows below the atari line", () => {
    // White j9 is in atari (Black j8); the learner captures it at h9, then White plays D5.
    mockBotPoint = 'd5';
    const game = position(
      `
      9 . . . . . . . . O
      8 . . . . . . . . X
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . O X O . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    let s = gameReducer({ ...session(), game }, { type: 'play', point: parseVertex('h9', 9) });
    s = gameReducer(s, { type: 'bot' });
    expect(s.coach.notes).toEqual([{ key: 'coach.you.capture', params: { count: 1 } }]);
    expect(dangerOf(s.game).map((g) => g.color)).toEqual(['B']);
  });

  it('with atari hints off, the coach keeps its atari notes (nothing else says it)', () => {
    mockBotPoint = 'd5';
    const off: GameSession = { ...startSession(2, 1, 0, false), game: BEFORE_D5 };
    expect(off.atariHints).toBe(false);
    let s = gameReducer(off, { type: 'play', point: parseVertex('j9', 9) });
    s = gameReducer(s, { type: 'bot' });
    expect(s.coach.notes.map((n) => n.key)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^coach\.(you\.exposed|bot\.atari)$/)]),
    );
    // Play again keeps the choice.
    expect(gameReducer(s, { type: 'new', seed: 2 }).atariHints).toBe(false);
  });
});
