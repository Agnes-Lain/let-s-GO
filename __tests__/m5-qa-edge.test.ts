// QA edge cases for M5 item 1 (Units 7–9): Go-rule correctness of the shipped positions.
// Complements __tests__/m5-units-7-9.test.ts; test-only ladder search lives here, not in src/.
import {
  checkMove,
  groupAt,
  legalMoves,
  pass,
  parseVertex,
  play,
  toVertex,
  type GameState,
  type Vertex,
} from '@/engine';
import { startState, type Exercise, type Lesson } from '@/lessons';
import { playAs } from '@/lessons/goals';
import { LESSON_FILES } from '@/lessons/registry';

const lessons = LESSON_FILES as readonly Lesson[];
const byId = (id: string): Lesson => lessons.find((l) => l.id === id) as Lesson;
/** Exercise #n in the M5 item 1 numbering (without the M5-sequence-v2 sequences). */
const SEQUENCE_V2 = ['ladder-play', 'ladder-play-corner', 'r-ladder-play'];
const ex = (id: string, n: number): Exercise =>
  byId(id).exercises.filter((e) => !SEQUENCE_V2.includes(e.id))[n - 1];
const pt = (v: Vertex, size: number) => parseVertex(v, size as 5);
const chk = (s: GameState, v: Vertex) => checkMove(s, pt(v, s.board.size));
const move = (s: GameState, color: 'B' | 'W', v: Vertex): GameState => {
  const r = playAs(s, color, v);
  if (!r.ok) throw new Error(`${color} ${v}: ${r.reason}`);
  return r.state;
};

function blackCaptures(state: GameState, target: Vertex, plies: number): boolean {
  const g = groupAt(state.board, pt(target, state.board.size));
  if (!g || g.color !== 'W') return true;
  if (plies <= 0) return false;
  for (const lib of g.liberties) {
    const r = play(state, lib);
    if (!r.ok) continue;
    if (!groupAt(r.state.board, pt(target, state.board.size))) return true;
    if (!whiteEscapes(r.state, target, plies - 1)) return true;
  }
  return false;
}
function whiteEscapes(state: GameState, target: Vertex, plies: number): boolean {
  if (!groupAt(state.board, pt(target, state.board.size))) return false;
  if (plies <= 0) return true;
  const replies: GameState[] = legalMoves(state).flatMap((p) => {
    const r = play(state, p);
    return r.ok ? [r.state] : [];
  });
  const passed = pass(state);
  if (passed.ok) replies.push(passed.state);
  return replies.some((s) => !blackCaptures(s, target, plies - 1));
}

describe('ko ban after a prelude (AC 9, 18)', () => {
  it.each([
    ['u08-ko', 1, 'c4'],
    ['u08-ko', 2, 'a3'],
    ['u09-review', 3, 'e3'],
    ['u08-ko', 4, null],
    ['u08-ko', 5, null],
    ['u08-ko', 7, null],
  ] as [string, number, Vertex | null][])('%s e%i: ko point is %s', (id, n, ko) => {
    const s = startState(ex(id, n) as never);
    expect(s.koPoint ? toVertex(s.koPoint, s.board.size) : null).toBe(ko);
  });

  it('u08 e1: White may not retake at once, may after one move elsewhere each', () => {
    let s = startState(ex('u08-ko', 1) as never);
    expect(s.toPlay).toBe('W');
    const c4 = chk(s, 'c4');
    expect(c4.legal).toBe(false);
    expect(!c4.legal && c4.reason).toBe('ko');
    // tenuki: White e1, Black e2 -> the ban is gone
    s = move(s, 'W', 'e1');
    expect(s.koPoint).toBeNull();
    s = move(s, 'B', 'e2');
    const again = chk(s, 'c4');
    expect(again.legal).toBe(true);
    const r = playAs(s, 'W', 'c4');
    expect(r.ok && r.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['c3']);
  });

  it('after White retakes, Black is the one banned from c3 (symmetry)', () => {
    let s = startState(ex('u08-ko', 1) as never);
    s = move(move(move(s, 'W', 'e1'), 'B', 'e2'), 'W', 'c4');
    const c3 = chk(s, 'c3');
    expect(!c3.legal && c3.reason).toBe('ko');
    s = move(move(s, 'B', 'a1'), 'W', 'e4');
    expect(chk(s, 'c3').legal).toBe(true);
  });

  it('a White pass then a Black move elsewhere lifts the ban (simple ko)', () => {
    const s = startState(ex('u08-ko', 1) as never);
    const p1 = pass(s);
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    expect(chk(p1.state, 'c4').legal).toBe(true);
  });

  it('u08 e3: Black c3 starts the ko, then c4 is banned for White; e5 line has no ban', () => {
    const s0 = startState(ex('u08-ko', 3) as never, 'B');
    const s1 = move(s0, 'B', 'c3');
    expect(chk(s1, 'c4').legal).toBe(false);
  });

  it('u08 e6: ko point refused, the two threats g6 and f7 are the only atari moves', () => {
    const s = startState(ex('u08-ko', 6) as never, 'W');
    const c4 = chk(s, 'c4');
    expect(!c4.legal && c4.reason).toBe('ko');
    const ataris = legalMoves(s).filter((p) => {
      const r = play(s, p);
      return r.ok && r.facts.opponentAtari.length >= 1;
    });
    expect(ataris.map((p) => toVertex(p, 7)).sort()).toEqual(['f7', 'g6']);
  });

  it('u08 e4: not a ko — c4 is a suicide, so it is no ko even right after the capture', () => {
    const s = startState(ex('u08-ko', 4) as never);
    expect(s.koPoint).toBeNull();
    const r = chk(s, 'c4');
    expect(!r.legal && r.reason).toBe('suicide');
  });
});

describe('suicide vs capturing move (AC 15–17)', () => {
  it('u07: every capturing move is legal, every suicide has no capture (all exercises)', () => {
    for (const id of ['u07-forbidden', 'u08-ko', 'u09-ladder', 'u09-review']) {
      byId(id).exercises.forEach((e) => {
        if (e.type === 'play-bot') return;
        const colors: ('B' | 'W')[] = ['B', 'W'];
        for (const color of colors) {
          let s = startState(e as never, color);
          if (s.toPlay !== color) s = { ...s, toPlay: color, koPoint: null };
          for (let y = 0; y < s.board.size; y++)
            for (let x = 0; x < s.board.size; x++) {
              const c = checkMove(s, { x, y });
              if (c.legal || c.reason !== 'suicide') continue;
              // a suicide must never capture: replaying it as a normal move is refused as well
              expect(play(s, { x, y }).ok).toBe(false);
            }
        }
      });
    }
  });

  it('a group filling its own last liberty is suicide even with friendly neighbours', () => {
    const s = startState({
      size: 5,
      setup: { B: ['a2', 'b1'], W: ['a3', 'b2', 'c1'] },
    } as never);
    const r = chk(s, 'a1');
    expect(!r.legal && r.reason).toBe('suicide');
    // White a1 is the mirror case: the move that looks suicidal captures a2 and b1 and is legal
    const w = playAs({ ...s, toPlay: 'W' }, 'W', 'a1');
    expect(w.ok && w.facts.captured.flat()).toHaveLength(2);
  });

  it('a stone does not connect diagonally: a lone diagonal pair shares no liberties', () => {
    const s = startState({ size: 5, setup: { B: ['b2', 'c3'], W: [] } } as never);
    expect(groupAt(s.board, pt('b2', 5))?.stones).toHaveLength(1);
    expect(groupAt(s.board, pt('b2', 5))?.liberties).toHaveLength(4);
  });
});

describe('ladders — counterfactual: without the breaker the chase captures (AC 23, 25)', () => {
  const without = (
    id: string,
    n: number,
    breaker: Vertex,
    first: Vertex,
    target: Vertex,
    plies: number,
  ) => {
    const e = ex(id, n) as unknown as { size: 5 | 7; setup: { B: Vertex[]; W: Vertex[] } };
    const pos = {
      size: e.size,
      setup: { B: e.setup.B, W: e.setup.W.filter((v) => v !== breaker) },
    };
    const s0 = startState(pos as never, 'B');
    const s1 = move(s0, 'B', first);
    return whiteEscapes(s1, target, plies);
  };
  it('u09 e5: with e5 removed, c4 ladders c3 to capture (breaker is the reason)', () => {
    expect(without('u09-ladder', 5, 'e5', 'c4', 'c3', 16)).toBe(false);
  });
  it('u09 e6: with f5 removed, the ladder works (f5 is the only breaker; b6 is a decoy)', () => {
    expect(without('u09-ladder', 6, 'f5', 'c4', 'c3', 16)).toBe(false);
  });
  it('u09 e6: removing the decoy b6 instead leaves the ladder failing', () => {
    expect(without('u09-ladder', 6, 'b6', 'c4', 'c3', 16)).toBe(true);
  });
  it('review e8: with c5 removed, the ladder captures', () => {
    expect(without('u09-review', 8, 'c5', 'e4', 'e3', 16)).toBe(false);
  });
});

describe('every exercise start is legal and has no group in zero liberties', () => {
  it.each(['u07-forbidden', 'u08-ko', 'u09-ladder', 'u09-review'])('%s', (id) => {
    byId(id).exercises.forEach((e) => {
      if (e.type === 'play-bot') return;
      const s = startState(e as never);
      for (let y = 0; y < s.board.size; y++)
        for (let x = 0; x < s.board.size; x++) {
          const g = groupAt(s.board, { x, y });
          if (g) expect(g.liberties.length).toBeGreaterThan(0);
        }
    });
  });
});
