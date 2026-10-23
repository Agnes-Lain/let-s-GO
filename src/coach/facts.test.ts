// Spec docs/specs/M6-game-coaching.md §4.1–4.2 (AC 1–14): the facts of one move and the note.
import { createGame, parseVertex, play, type GameState, type Move } from '@/engine';

import { position } from '@/bot/__fixtures__/board';

import { moveNote, pickNote, type CoachFact } from './facts';

/** Plays `at` for `state.toPlay` and returns the facts of that move. */
function factsOf(state: GameState, at: string): CoachFact[] {
  const result = play(state, at);
  if (!result.ok) throw new Error(`${at} is illegal: ${result.reason}`);
  const move: Move = { type: 'play', color: state.toPlay, point: parseVertex(at, 9) };
  return moveNote(state, move, result.state, result.facts);
}

const pt = (v: string) => parseVertex(v, 9);

describe('moveNote (AC 1–9)', () => {
  it('AC 1 (fixture A): Black e5 captures White d5', () => {
    const before = position(
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
    expect(factsOf(before, 'e5')).toEqual([
      { kind: 'capture', color: 'B', point: pt('d5'), count: 1 },
    ]);
  });

  it('AC 2: one move captures two groups (1 + 2 stones): count 3', () => {
    const before = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . X . . .
      6 . . . X X O X . .
      5 . . X O . O X . .
      4 . . . X . X . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    const facts = factsOf(before, 'e5');
    expect(facts.find((f) => f.kind === 'capture')).toEqual({
      kind: 'capture',
      color: 'B',
      point: pt('d5'),
      count: 3,
    });
  });

  it('AC 3 (fixture B): Black a1 next to White b1 is self-atari (liberty a2)', () => {
    const before = position(
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
    expect(factsOf(before, 'a1')).toEqual([
      { kind: 'selfAtari', color: 'B', point: pt('a1'), size: 1 },
    ]);
  });

  it('AC 4 (fixture C): Black e7 puts White e5 e6 in atari (size 2, point e5)', () => {
    const before = position(
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
    const facts = factsOf(before, 'e7');
    expect(facts).toContainEqual({ kind: 'atari', color: 'B', point: pt('e5'), size: 2 });
    // The same group seen from White: it went from 2 liberties (e4 e7) to 1.
    expect(facts).toContainEqual({ kind: 'exposed', color: 'W', point: pt('e5'), size: 2 });
    expect(pickNote(facts, 'B', 'B')).toEqual({
      key: 'coach.you.atari',
      params: { count: 2, point: 'E5' },
    });
  });

  it('AC 5 (fixture D): Black d6 rescues d5 from atari (3 liberties)', () => {
    const before = position(
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
    expect(factsOf(before, 'd6')).toEqual([
      { kind: 'escape', color: 'B', point: pt('d6'), size: 2 },
    ]);
  });

  it('AC 6 (fixture E): White d4 leaves Black c3 c4 with one liberty (c2): exposed', () => {
    const before = position(
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
      'W',
    );
    const facts = factsOf(before, 'd4');
    expect(facts).toContainEqual({ kind: 'exposed', color: 'B', point: pt('c3'), size: 2 });
    // The learner (Black) reads it as "Your group at c3 has one liberty left".
    expect(pickNote(facts, 'B', 'W')).toEqual({
      key: 'coach.you.exposed',
      params: { count: 2, point: 'C3' },
    });
  });

  it('AC 7: a quiet move has no facts and no note', () => {
    const before = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . X . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'W',
    );
    const facts = factsOf(before, 'c3');
    expect(facts).toEqual([]);
    expect(pickNote(facts, 'B', 'W')).toBeNull();
  });

  it('AC 8: a pass has no facts', () => {
    const before = createGame(9);
    expect(moveNote(before, { type: 'pass', color: 'B' }, before, null)).toEqual([]);
  });
});

describe('pickNote (AC 10–14): one line, highest priority first', () => {
  const capture: CoachFact = { kind: 'capture', color: 'W', point: pt('c3'), count: 3 };
  const selfAtari: CoachFact = { kind: 'selfAtari', color: 'W', point: pt('d4'), size: 1 };
  const exposed: CoachFact = { kind: 'exposed', color: 'B', point: pt('e5'), size: 2 };
  const atari: CoachFact = { kind: 'atari', color: 'W', point: pt('e5'), size: 2 };
  const escape: CoachFact = { kind: 'escape', color: 'W', point: pt('f6'), size: 2 };

  it('AC 13: the bot capture beats everything', () => {
    expect(pickNote([escape, atari, exposed, selfAtari, capture], 'B', 'W')).toEqual({
      key: 'coach.bot.capture',
      params: { count: 3 },
    });
  });

  it('priority capture > selfAtari > exposed > atari > escape', () => {
    expect(pickNote([escape, atari, exposed, selfAtari], 'B', 'W')?.key).toBe(
      'coach.bot.selfAtari',
    );
    expect(pickNote([escape, atari, exposed], 'B', 'W')?.key).toBe('coach.you.exposed');
    expect(pickNote([escape, atari], 'B', 'W')?.key).toBe('coach.bot.atari');
    expect(pickNote([escape], 'B', 'W')?.key).toBe('coach.bot.escape');
  });

  it('AC 14: the learner self-atari note names the stone, never "mistake"', () => {
    const own: CoachFact = { kind: 'selfAtari', color: 'B', point: pt('a1'), size: 1 };
    expect(pickNote([own], 'B', 'B')).toEqual({
      key: 'coach.you.selfAtari',
      params: { count: 1, point: 'A1' },
    });
  });

  it("the learner's own capture and escape", () => {
    const mine: CoachFact = { kind: 'capture', color: 'B', point: pt('d5'), count: 1 };
    expect(pickNote([mine], 'B', 'B')).toEqual({ key: 'coach.you.capture', params: { count: 1 } });
    const ran: CoachFact = { kind: 'escape', color: 'B', point: pt('d6'), size: 2 };
    expect(pickNote([ran], 'B', 'B')).toEqual({ key: 'coach.you.escape' });
  });

  it("an exposed bot group on the learner's move is said as the atari line, not twice", () => {
    const theirs: CoachFact = { kind: 'exposed', color: 'W', point: pt('e5'), size: 2 };
    const mine: CoachFact = { kind: 'atari', color: 'B', point: pt('e5'), size: 2 };
    expect(pickNote([theirs], 'B', 'B')).toBeNull();
    expect(pickNote([mine, theirs], 'B', 'B')?.key).toBe('coach.you.atari');
  });
});
