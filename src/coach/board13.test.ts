// Spec docs/specs/M6b-13x13-game.md AC 33–35: coaching notes and hints on a 13×13 board use
// 13×13 labels (columns a–h, j–n, no "i") and never throw on points beyond the 9×9 range.
import { parseVertex, play, type GameState, type Move } from '@/engine';

import { position } from '@/bot/__fixtures__/board';

import { hintFor, moveNote, pickNote } from './index';

function noteOf(state: GameState, at: string, learner: 'B' | 'W') {
  const result = play(state, at);
  if (!result.ok) throw new Error(`${at} is illegal: ${result.reason}`);
  const move: Move = { type: 'play', color: state.toPlay, point: parseVertex(at, 13) };
  const facts = moveNote(state, move, result.state, result.facts);
  return pickNote(facts, learner, state.toPlay, 13);
}

// White k10 has one liberty left after Black plays l10 (k11, j10, k9 are Black).
const ATARI_K10 = position(
  `
  13 . . . . . . . . . . . . .
  12 . . . . . . . . . . . . .
  11 . . . . . . . . . X . . .
  10 . . . . . . . . X O . . .
   9 . . . . . . . . . X . . .
   8 . . . . . . . . . . . . .
   7 . . . . . . . . . . . . .
   6 . . . . . . . . . . . . .
   5 . . . . . . . . . . . . .
   4 . . . . . . . . . . . . .
   3 . . . . . . . . . . . . .
   2 . . . . . . . . . . . . .
   1 . . . . . . . . . . . . .
     a b c d e f g h j k l m n
  `,
  'B',
);

describe('AC 35: coaching notes on 13×13', () => {
  it('the learner’s capture at l10 names no point but counts one stone', () => {
    expect(noteOf(ATARI_K10, 'l10', 'B')).toEqual({
      key: 'coach.you.capture',
      params: { count: 1 },
    });
  });

  it('the note after the bot’s atari names the 13×13 point ("K11", no "I")', () => {
    // White k12 leaves Black k11 one liberty (j11): the learner hears that their stone is exposed.
    const before = position(
      `
      13 . . . . . . . . . . . . .
      12 . . . . . . . . . . . . .
      11 . . . . . . . . . X O . .
      10 . . . . . . . . . O . . .
       9 . . . . . . . . . . . . .
       8 . . . . . . . . . . . . .
       7 . . . . . . . . . . . . .
       6 . . . . . . . . . . . . .
       5 . . . . . . . . . . . . .
       4 . . . . . . . . . . . . .
       3 . . . . . . . . . . . . .
       2 . . . . . . . . . . . . .
       1 . . . . . . . . . . . . .
         a b c d e f g h j k l m n
      `,
      'W',
    );
    expect(noteOf(before, 'k12', 'B')).toEqual({
      key: 'coach.you.exposed',
      params: { count: 1, point: 'K11' },
    });
  });
});

describe('AC 33: the hint works on 13×13', () => {
  it('points at the capture l10', () => {
    const hint = hintFor(ATARI_K10);
    expect(hint.point).toEqual(parseVertex('l10', 13));
    expect(hint.category).toBe('capture');
  });
});
