// QA edge cases for M6 game coaching (facts, hint, review): Go-rule corners the unit tests skip.
import {
  checkMove,
  createGame,
  parseVertex,
  pass,
  play,
  type GameState,
  type Move,
} from '@/engine';

import { position, playAt } from '@/bot/__fixtures__/board';
import { formatParams } from '@/game9/format';
import i18n from '@/i18n';

import { moveNote, pickNote, type CoachFact } from './facts';
import { hintFor } from './hint';
import { buildReview } from './review';

const pt = (v: string) => parseVertex(v, 9);

function factsOf(state: GameState, at: string): CoachFact[] {
  const result = play(state, at);
  if (!result.ok) throw new Error(`${at} is illegal: ${result.reason}`);
  const move: Move = { type: 'play', color: state.toPlay, point: pt(at) };
  return moveNote(state, move, result.state, result.facts);
}

describe('QA: facts on edges, ko and snapback', () => {
  it('corner capture: White b1 + a2 take Black a1', () => {
    const real = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 X O . . . . . . .
      `,
      'W',
    );
    expect(factsOf(real, 'a2')).toEqual([
      { kind: 'capture', color: 'W', point: pt('a1'), count: 1 },
    ]);
  });

  it('edge group of 3 captured: count 3, point is the first stone', () => {
    // Black a1 b1 c1 has no liberty left only after White's last stone: remove d2 to test.
    const real = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 O O . . . . . . .
      1 X X X O . . . . .
      `,
      'W',
    );
    expect(factsOf(real, 'c2')).toEqual([
      { kind: 'capture', color: 'W', point: pt('a1'), count: 3 },
    ]);
  });

  it('self-atari that is also a capture: both facts, the note is the capture', () => {
    // Black e5 captures d5 but e5 keeps only the liberty d5.
    const s = position(
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
    const facts = factsOf(s, 'e5');
    expect(facts.map((f) => f.kind)).toEqual(['capture', 'selfAtari']);
    expect(pickNote(facts, 'B', 'B')).toEqual({ key: 'coach.you.capture', params: { count: 1 } });
  });

  it('ko: the recapture is a one-stone capture note; the immediate retake is illegal', () => {
    const s = position(
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
    expect(factsOf(s, 'e5')[0]).toMatchObject({ kind: 'capture', count: 1 });
    const afterB = playAt(s, 'e5');
    expect(checkMove(afterB, pt('d5'))).toMatchObject({ legal: false });
    // after a move elsewhere by each side the retake is legal again and is noted as a capture
    const later = playAt(playAt(afterB, 'h8'), 'a9');
    expect(checkMove(later, pt('d5'))).toEqual({ legal: true });
  });

  it('hint never proposes the ko retake or a suicide', () => {
    const s = position(
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
    const ko = playAt(s, 'e5'); // White to move, d5 is a ko point
    for (let i = 0; i < 3; i++) {
      const h = hintFor(ko);
      if (h.point) {
        expect(checkMove(ko, h.point)).toEqual({ legal: true });
        expect(h.point).not.toEqual(pt('d5'));
      }
    }
  });

  it('snapback: throw-in is a self-atari note, the retake captures 2 (not ko)', () => {
    const s = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 O O O X . . . . .
      3 . O X X . . . . .
      2 . X X X O . . . .
      1 O X O O . . . . .
      `,
      'B',
    );
    expect(factsOf(s, 'a3').map((f) => f.kind)).toEqual(['selfAtari']);
    const w = playAt(s, 'a3');
    expect(factsOf(w, 'a2').map((f) => f.kind)).toEqual(['capture', 'selfAtari']);
    const b = playAt(w, 'a2');
    const f = factsOf(b, 'a3');
    expect(f[0]).toMatchObject({ kind: 'capture', color: 'B', count: 2 });
  });

  it('diagonal stones are not one group: atari size stays 1', () => {
    const s = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . X O . . . . .
      4 . . O . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    const f = factsOf(s, 'd4');
    expect(f.find((x) => x.kind === 'atari')).toBeUndefined();
  });
});

describe('QA: hint', () => {
  it('on a board where only suicide/eye-filling remain, the hint is a legal point or "pass"', () => {
    const s = position(
      `
      9 . X O . . . . . .
      8 X X O . . . . . .
      7 O O O . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'W',
    );
    const h = hintFor(s);
    if (h.point) expect(checkMove(s, h.point)).toEqual({ legal: true });
    else expect(h.category).toBe('pass');
  });
});

describe('QA: review', () => {
  function game(n: number): Move[] {
    let s = createGame(9, { komi: 5.5 });
    const pts = ['e5', 'e6', 'd5', 'd6', 'c5', 'c6', 'f5', 'f6', 'g5', 'g6', 'b5', 'b6'];
    for (let i = 0; i < n; i++) {
      const r = play(s, pts[i]);
      if (!r.ok) throw new Error(pts[i]);
      s = r.state;
    }
    return [...s.moves];
  }

  it('same seed gives identical output, also for a White learner; passes in the record are fine', () => {
    let s = createGame(9, { komi: 5.5 });
    for (const v of ['e5', 'e6', 'pass', 'pass']) {
      const r = v === 'pass' ? pass(s) : play(s, v);
      if (!r.ok) throw new Error(v);
      s = r.state;
    }
    const moves = [...s.moves];
    expect(buildReview(moves, 5.5, 7, 'W')).toEqual(buildReview(moves, 5.5, 7, 'W'));
    const g = game(12);
    expect(buildReview(g, 5.5, 3)).toEqual(buildReview(g, 5.5, 3));
    expect(buildReview(g, 5.5, 3).length).toBeLessThanOrEqual(3);
  });

  it('a resigned game (record has no resign move) reviews like any other', () => {
    const g = game(12);
    expect(() => buildReview(g, 5.5, 1)).not.toThrow();
  });
});

describe('QA: notes are rendered through the app i18n (formatParams)', () => {
  // Was a blocker: a string `count` made i18next skip `_one/_other` (raw keys on screen).
  it.each(['zh-CN', 'en', 'fr'])('%s: the capture note resolves to real text', async (lng) => {
    await i18n.changeLanguage(lng);
    const note = { key: 'coach.you.capture', params: { count: 2 } };
    const text = i18n.t(note.key, formatParams(note, lng));
    expect(text).not.toBe(note.key);
    expect(text).toContain('2');
  });
});
