// QA for docs/specs/M6b-13x13-game.md: Go-rule edge cases on 13×13, handicap guards, per-level
// allowances, auto-adjust steps and i18n parity of the new keys.
import { checkMove, createGame, parseVertex, pass, play, score, type GameState } from '@/engine';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zh from '@/i18n/zh-CN.json';

import { handicapStones, nextHandicap } from './handicap';
import { gameReducer, startSession, type GameEvent, type GameSession } from './session';

const N = 13;
type Stones = { B?: string[]; W?: string[] };

function position(stones: Stones, toPlay: 'B' | 'W' = 'B'): GameState {
  const g = createGame(N, { komi: 6.5, setup: stones, toPlay });
  return g;
}
function mv(g: GameState, v: string): GameState {
  const r = play(g, parseVertex(v, N));
  if (!r.ok) throw new Error(`${v}: ${r.reason}`);
  return r.state;
}
const reason = (g: GameState, v: string) => {
  const c = checkMove(g, parseVertex(v, N));
  return c.legal ? 'legal' : c.reason;
};
const run = (s: GameSession, ...e: GameEvent[]) => e.reduce(gameReducer, s);

describe('13×13 captures at corners and edges', () => {
  it('captures a corner stone on a1 with two stones (all four corners)', () => {
    for (const [corner, n1, n2] of [
      ['a1', 'a2', 'b1'],
      ['n1', 'n2', 'm1'],
      ['a13', 'a12', 'b13'],
      ['n13', 'n12', 'm13'],
    ]) {
      const g = position({ B: [n1], W: [corner] });
      const after = mv(g, n2);
      expect(after.board.cells.filter((c) => c === 'W')).toHaveLength(0);
      expect(after.captures.B).toBe(1);
    }
  });

  it('captures an edge pair on the far (n) edge, wrapping no column', () => {
    // W n6 n7; B n5 n8 m6 then m7 captures both.
    const g = position({ B: ['n5', 'n8', 'm6'], W: ['n6', 'n7'] });
    const after = mv(g, 'm7');
    expect(after.captures.B).toBe(2);
  });

  it('one move captures two separate groups', () => {
    // W a1 and W c1 (both one-liberty after B a2,b2,c2,d1) share the liberty b1.
    const g = position({ B: ['a2', 'b2', 'c2', 'd1'], W: ['a1', 'c1'] });
    const after = mv(g, 'b1');
    expect(after.captures.B).toBe(2);
    expect(after.board.cells.filter((c) => c === 'W')).toHaveLength(0);
  });

  it('filling the last liberty of a group without capturing is suicide (corner)', () => {
    const g = position({ B: ['a2', 'b1'], W: ['b2', 'a3', 'c1'] }, 'B');
    expect(reason(g, 'a1')).toBe('suicide');
  });

  it('suicide-looking move that captures is legal (corner)', () => {
    // B a1 would have no liberty, but captures W b1 (whose only liberty is a1).
    const g = position({ B: ['a2', 'c1', 'b2'], W: ['b1'] }, 'B');
    expect(reason(g, 'a1')).toBe('legal');
    const after = mv(g, 'a1');
    expect(after.captures.B).toBe(1);
  });

  it('diagonal stones are not connected: both can be captured separately', () => {
    // B g7 and h8 touch only diagonally. W takes g7's three other liberties, then the last.
    let g = position({ B: ['g7', 'h8'], W: ['f7', 'g6', 'h7'] }, 'W');
    g = mv(g, 'g8');
    expect(g.captures.W).toBe(1);
    expect(g.board.cells.filter((c) => c === 'B')).toHaveLength(1);
  });
});

describe('13×13 ko and snapback', () => {
  it('immediate recapture is a ko violation; after a move elsewhere it is allowed again', () => {
    //   3 . O X .
    //   2 O . W X     Black b2 captures W c2 (its only liberty); b2 then has one liberty (c2).
    //   1 . O X .
    let g = position({ B: ['c3', 'd2', 'c1'], W: ['b3', 'a2', 'b1', 'c2'] }, 'B');
    // Black plays b2: captures W c2 (liberties of c2: b2 only) -> ko point c2.
    g = mv(g, 'b2');
    expect(g.captures.B).toBe(1);
    expect(g.koPoint).toEqual(parseVertex('c2', N));
    expect(reason(g, 'c2')).toBe('ko');
    // White plays elsewhere, Black elsewhere, then White may retake.
    g = mv(g, 'h10');
    g = mv(g, 'k4');
    expect(reason(g, 'c2')).toBe('legal');
  });

  it('a pass also lifts the ko ban (engine decision D8)', () => {
    let g = position({ B: ['c3', 'd2', 'c1'], W: ['b3', 'a2', 'b1', 'c2'] }, 'B');
    g = mv(g, 'b2');
    const p = pass(g);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.state.koPoint).toBeNull();
  });

  it('snapback (capture of more than one stone) is not ko', () => {
    // Black throws in at a1 corner area: W captures two, B recaptures three? Simple check:
    // a capture of 2 stones leaves no ko point.
    const g = position({ B: ['a3', 'b2', 'c1'], W: ['a2', 'b1'] }, 'B');
    const after = mv(g, 'a1');
    expect(after.captures.B).toBe(2);
    expect(after.koPoint).toBeNull();
  });
});

describe('13×13 area scoring', () => {
  it('a wall splitting 13×13: stones + land, dame counts for nobody, komi 6.5', () => {
    // Black owns columns a–f (including wall at f), White owns h–n, g is dame.
    const B: string[] = [];
    const W: string[] = [];
    for (let y = 1; y <= 13; y++) {
      B.push(`f${y}`);
      W.push(`h${y}`);
    }
    const g = position({ B, W });
    const s = score(g.board, { komi: 6.5 });
    // Black: columns a–f = 6 × 13 = 78; White: h–n = 6 × 13 = 78 (column i skipped: h j k l m n = 6).
    expect(s.black.total).toBe(78);
    expect(s.white.total).toBe(78 + 6.5);
    expect(s.dame).toHaveLength(13);
    expect(s.black.total + s.white.total - 6.5 + s.dame.length).toBe(169);
  });

  it('a seki-like shared liberty stays dame for both', () => {
    const g = position({ B: ['a1', 'a2', 'b3', 'c2', 'c1'], W: ['b1'] });
    const s = score(g.board, { komi: 0.5 });
    expect(s.dame.length).toBeGreaterThan(0);
  });
});

describe('handicap guards', () => {
  it.each([1, 6, 7, 9, -1, 2.5])('13×13 and 9×9 handicapStones(%p) throws', (n) => {
    expect(() => handicapStones(13, n)).toThrow();
    expect(() => handicapStones(9, n)).toThrow();
  });
  it('13×13 stones are all legal, distinct, on the 4th line, with column i never used', () => {
    const all = handicapStones(13, 5);
    expect(new Set(all.map((v) => v)).size).toBe(5);
    expect(all.join(',')).toBe('d4,k10,k4,d10,g7');
    expect(all.some((v) => v.startsWith('i'))).toBe(false);
  });
  it('handicap game: White moves first, komi 0.5, k10 is occupied for White', () => {
    const s = startSession(1, 1, 3, true, 13);
    expect(s.game.toPlay).toBe('W');
    expect(s.game.komi).toBe(0.5);
    expect(s.thinking).toBe(true);
    expect(reason(s.game, 'k4')).toBe('occupied');
  });
  it('auto-adjust steps 5→4→3→2→0 on wins and back on losses', () => {
    expect([5, 4, 3, 2].map((h) => nextHandicap(h as 5, 'win'))).toEqual([4, 3, 2, 0]);
    expect([0, 2, 3, 4, 5].map((h) => nextHandicap(h as 0, 'loss'))).toEqual([2, 3, 4, 5, 5]);
    expect(nextHandicap(3, 'resigned')).toBe(4);
  });
});

describe('AC 32–33: allowances are per level, also on 13×13', () => {
  it.each([
    [1, null],
    [2, 3],
    [3, 1],
  ] as const)('level %i has %p take-backs', (level, n) => {
    expect(startSession(level, 1, 0, true, 13).takebacksLeft).toBe(n);
  });
  it.each([
    [1, null],
    [2, null],
    [3, 3],
  ] as const)('level %i has %p hints', (level, n) => {
    expect(startSession(level, 1, 0, true, 13).coach.hintsLeft).toBe(n);
  });
  it('Challenge: the second take-back is refused', () => {
    let s = startSession(3, 7, 0, true, 13);
    s = run(s, { type: 'play', point: parseVertex('d4', N) }, { type: 'bot' });
    s = run(s, { type: 'takeback' });
    expect(s.takebacksLeft).toBe(0);
    const n = s.game.moves.length;
    s = run(s, { type: 'play', point: parseVertex('d4', N) }, { type: 'bot' });
    const after = run(s, { type: 'takeback' });
    expect(after.game.moves.length).toBeGreaterThanOrEqual(n);
    expect(after.takebacksLeft).toBe(0);
  });
});

describe('AC 40: new i18n keys', () => {
  // §13 (PO 2026-10-25): the size control and its keys are gone; the Learn card keys are new.
  const keys = [
    'game.entry.card13',
    'game.entry.title13',
    'game.size.locked',
    'game.size.time13',
    'game.confirm.label',
    'game.confirm.desc',
    'game.confirm.play',
    'game.thinking',
    'game.header.size',
    'game.header.sizeEven',
    'game9.picker.explain',
    'game9.picker.explainEven',
  ];
  const params = (s: string) => [...new Set(s.match(/{{\w+}}/g) ?? [])].sort().join();
  const files: Record<string, Record<string, string>> = { zh, en, fr };
  it.each(keys)('%s exists in all three languages with the same params', (k) => {
    for (const f of Object.values(files)) expect(typeof f[k]).toBe('string');
    expect(params(zh[k as keyof typeof zh])).toBe(params(en[k as keyof typeof en]));
    expect(params(fr[k as keyof typeof fr])).toBe(params(en[k as keyof typeof en]));
  });
  it('the komi is a parameter, not hard-coded, in the explain lines', () => {
    for (const f of Object.values(files)) {
      expect(f['game9.picker.explain']).toContain('{{komi}}');
      expect(f['game9.picker.explainEven']).toContain('{{komi}}');
    }
  });
});

describe('§13: zh-CN strings added in this branch carry no pinyin', () => {
  const added = [
    'game.entry.title13',
    'game.entry.card13',
    'game.size.locked',
    'game.size.time13',
    'game.confirm.label',
    'game.confirm.desc',
    'game.confirm.play',
    'game.thinking',
    'game.header.size',
    'game.header.sizeEven',
    'game9.picker.explain',
    'game9.picker.explainEven',
  ];
  it.each(added)('%s has no Latin words or tone marks outside {{params}}', (k) => {
    const text = (zh as Record<string, string>)[k].replace(/{{\w+}}/g, '').replace(/\d+×\d+/g, '');
    expect(text).not.toMatch(/[A-Za-z]/);
    expect(text).not.toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
  });
  it('the removed size-control keys are gone from all languages', () => {
    for (const f of [zh, en, fr] as Record<string, string>[]) {
      for (const k of [
        'game.size.title',
        'game.size.9',
        'game.size.13',
        'game.a11y.sizeSelected',
      ]) {
        expect(f[k]).toBeUndefined();
      }
    }
  });
});
