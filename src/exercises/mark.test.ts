// Pure mark logic (spec docs/specs/M5-territory-counting.md AC 23–34). ASCII boards: X black, O white.
import { parseBoard } from '@/engine';

import { judgeMarks, tapMark, type MarkSpec } from './mark';

const P3 = parseBoard(`
  5 . X . O .
  4 . X . O .
  3 . X . O .
  2 . X . O .
  1 . X . O .
    a b c d e
`).board;

const C = parseBoard(`
  5 . . . . .
  4 O O O O .
  3 X X X O .
  2 . . X O .
  1 . . X O .
    a b c d e
`).board;

const D = parseBoard(`
  5 . . . . .
  4 O O O O O
  3 X X X . .
  2 . . X X X
  1 . . . . .
    a b c d e
`).board;

const N = parseBoard(`
  5 . . X . .
  4 . . . . .
  3 O O O O O
  2 X X X X X
  1 . . O . .
    a b c d e
`).board;

const territoryB: MarkSpec = { mark: 'territory', side: 'B' };
const deadN: MarkSpec = {
  mark: 'dead',
  dead: ['c1', 'c5'],
  whyKeys: { a2: 'why.black', a3: 'why.white' },
};

describe('tapMark — territory (AC 23–24)', () => {
  it('an empty point toggles a mark', () => {
    const on = tapMark(P3, territoryB, [], 'a1');
    expect(on).toEqual({ kind: 'toggled', marks: ['a1'], points: ['a1'], added: true });
    const off = tapMark(P3, territoryB, ['a1', 'a2'], 'a1');
    expect(off).toEqual({ kind: 'toggled', marks: ['a2'], points: ['a1'], added: false });
  });

  it('a stone is not territory: a note, never a mark or a mistake', () => {
    expect(tapMark(P3, territoryB, ['a1'], 'b3')).toEqual({
      kind: 'note',
      line: { key: 'fb.mark.extra.stone' },
    });
  });
});

describe('tapMark — dead (AC 31–32)', () => {
  it('a stone marks its whole group; a second tap on any stone of it unmarks the group', () => {
    const wall = tapMark(N, deadN, [], 'c2');
    expect(wall).toEqual({
      kind: 'toggled',
      marks: ['a2', 'b2', 'c2', 'd2', 'e2'],
      points: ['a2', 'b2', 'c2', 'd2', 'e2'],
      added: true,
    });
    const off = tapMark(N, deadN, ['a2', 'b2', 'c1', 'c2', 'd2', 'e2'], 'e2');
    expect(off).toMatchObject({ kind: 'toggled', marks: ['c1'], added: false });
  });

  it('an empty point is a note: "Tap a stone."', () => {
    expect(tapMark(N, deadN, [], 'b1')).toEqual({ kind: 'note', line: { key: 'fb.mark.empty' } });
  });
});

describe('judgeMarks — territory (AC 25–28)', () => {
  it('exactly the solution is correct', () => {
    const j = judgeMarks(P3, territoryB, ['a5', 'a1', 'a2', 'a3', 'a4']);
    expect(j.correct).toBe(true);
    expect(j.lines).toEqual([]);
  });

  it('AC 27: P3, a1..a5 + c3 → c3 is neutral and removed; nothing missing', () => {
    const j = judgeMarks(P3, territoryB, ['a1', 'a2', 'a3', 'a4', 'a5', 'c3']);
    expect(j).toEqual({
      correct: false,
      keep: ['a1', 'a2', 'a3', 'a4', 'a5'],
      extra: ['c3'],
      lines: [{ key: 'fb.mark.extra.dame', params: { points: 'c3' } }],
    });
  });

  it('AC 28: C, only a1 a2 → no extras, 2 still to find, marks stay', () => {
    const j = judgeMarks(C, territoryB, ['a1', 'a2']);
    expect(j).toEqual({
      correct: false,
      keep: ['a1', 'a2'],
      extra: [],
      lines: [{ key: 'fb.mark.missing', params: { count: 2 } }],
    });
  });

  it('AC 26: neutral first, then other side, at most two lines (missing dropped)', () => {
    // D: d3 e3 are neutral, a5 is White's territory; b1 is still missing.
    const j = judgeMarks(D, territoryB, ['a1', 'a2', 'b2', 'c1', 'd1', 'e1', 'e3', 'd3', 'a5']);
    expect(j.extra).toEqual(['e3', 'd3', 'a5']);
    expect(j.lines).toEqual([
      { key: 'fb.mark.extra.dame', params: { points: 'd3, e3' } },
      { key: 'fb.mark.extra.other', params: { points: 'a5' } },
    ]);
  });

  it('other-side extras with something missing: two lines (other, missing)', () => {
    const j = judgeMarks(D, territoryB, ['a1', 'b5']);
    expect(j.lines).toEqual([
      { key: 'fb.mark.extra.other', params: { points: 'b5' } },
      { key: 'fb.mark.missing', params: { count: 6 } },
    ]);
  });
});

describe('judgeMarks — dead (AC 33–34)', () => {
  it('both dead stones: correct', () => {
    expect(judgeMarks(N, deadN, ['c5', 'c1']).correct).toBe(true);
  });

  it('AC 33: c1 + the black wall → the wall is removed with its whyKey; 1 still to find', () => {
    const j = judgeMarks(N, deadN, ['a2', 'b2', 'c1', 'c2', 'd2', 'e2']);
    expect(j).toEqual({
      correct: false,
      keep: ['c1'],
      extra: ['a2', 'b2', 'c2', 'd2', 'e2'],
      lines: [{ key: 'why.black' }, { key: 'fb.mark.missing', params: { count: 1 } }],
    });
  });

  it('AC 34: an alive group without a whyKey gets the generic line with its point', () => {
    const noWhy: MarkSpec = { mark: 'dead', dead: ['c1', 'c5'] };
    const j = judgeMarks(N, noWhy, ['a3', 'b3', 'c3', 'd3', 'e3', 'c1', 'c5']);
    expect(j.lines).toEqual([{ key: 'fb.mark.extra.alive', params: { point: 'a3' } }]);
  });
});
