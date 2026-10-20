// M5 item 1 — Units 7–9 (forbidden points, ko, ladder) + checkpoint u09-review.
// Acceptance criteria of docs/specs/M5-ko-forbidden-ladders.md §4 (Option B, §12a).
// ACs 2 and 5–6 (validity with texts, text limits, key parity) are also covered by
// src/lessons/content.test.ts and src/i18n tests; AC 9–14 by src/lessons/validate.prelude.test.ts.
import {
  checkMove,
  groupAt,
  legalMoves,
  pass,
  play,
  toVertex,
  type GameState,
  type Vertex,
} from '@/engine';
import { nodeAfter } from '@/exercises/nextNode';
import {
  PLANNED_UNITS,
  capturedCount,
  computeStars,
  endCells,
  explainFrames,
  getSolution,
  getUnits,
  isCheckpointUnlocked,
  isUnlocked,
  mapRows,
  nextNode,
  playMoveSolutions,
  startState,
  type Exercise,
  type Lesson,
  type StarsByLesson,
} from '@/lessons';
import { playAs } from '@/lessons/goals';
import { LESSON_FILES, LESSON_TEXTS } from '@/lessons/registry';

type Outcome = Parameters<typeof computeStars>[0][number];

const lessons = LESSON_FILES as readonly Lesson[];
const byId = (id: string): Lesson => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
};
const M5 = ['u07-forbidden', 'u08-ko', 'u09-ladder', 'u09-review'] as const;
const exercise = (id: string, n: number): Exercise => byId(id).exercises[n - 1];
const stars = (entries: Record<string, number>): StarsByLesson =>
  Object.fromEntries(
    Object.entries(entries).map(([id, n]) => [id, { stars: n }]),
  ) as unknown as StarsByLesson;

/** The start of an exercise (after its prelude) with `color` to move (a stale ko ban dropped). */
function startAs(ex: Exercise, color: 'B' | 'W'): GameState {
  const state = startState(ex);
  return state.toPlay === color ? state : { ...state, toPlay: color, koPoint: null };
}

/** Liberties of the group on `at`, sorted, or null when `at` is empty. */
function libs(state: GameState, at: Vertex): Vertex[] | null {
  const group = groupAt(state.board, at);
  return group ? group.liberties.map((p) => toVertex(p, state.board.size)).sort() : null;
}

/** Empty points where `color` may not play because of `reason`. */
function illegalPoints(state: GameState, reason: 'suicide' | 'ko'): Vertex[] {
  const size = state.board.size;
  const out: Vertex[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (state.board.cells[y * size + x] !== null) continue;
      const check = checkMove(state, { x, y });
      if (!check.legal && check.reason === reason) out.push(toVertex({ x, y }, size));
    }
  return out.sort();
}

/** Replays `moves` (alternating, starting with `first`) and returns every state. */
function replay(start: GameState, first: 'B' | 'W', moves: Vertex[]) {
  const states: { state: GameState; captured: number }[] = [];
  let state = start;
  moves.forEach((at, i) => {
    const color = (i % 2 === 0) === (first === 'B') ? 'B' : 'W';
    const result = playAs(state, color, at);
    if (!result.ok) throw new Error(`${color} ${at}: ${result.reason}`);
    state = result.state;
    states.push({ state, captured: capturedCount(result.facts) });
  });
  return states;
}

const createPosition = (size: 5 | 7, B: Vertex[], W: Vertex[]) =>
  startState({ size, setup: { B, W } });

// ---- A tiny test-only ladder search (AC 25; not shipped) ----
// Black may only play on a liberty of the target (enough to PROVE a capture); White may play
// anything legal or pass. A White move that leaves the target in atari is refuted at once when
// Black can take the last liberty.
function blackCaptures(state: GameState, target: Vertex, plies: number): boolean {
  const group = groupAt(state.board, target);
  if (!group || group.color !== 'W') return true;
  if (plies <= 0) return false;
  for (const lib of group.liberties) {
    const result = play(state, lib);
    if (!result.ok) continue;
    if (!groupAt(result.state.board, target)) return true;
    if (!whiteEscapes(result.state, target, plies - 1)) return true;
  }
  return false;
}
function whiteEscapes(state: GameState, target: Vertex, plies: number): boolean {
  if (!groupAt(state.board, target)) return false;
  if (plies <= 0) return true;
  const replies: GameState[] = legalMoves(state).flatMap((p) => {
    const result = play(state, p);
    return result.ok ? [result.state] : [];
  });
  const passed = pass(state);
  if (passed.ok) replies.push(passed.state);
  return replies.some((reply) => !blackCaptures(reply, target, plies - 1));
}
const PLIES = 12;

describe('A. files (AC 1, 3, 4, 7, 8)', () => {
  it('AC 1: the four files are registered and named after their id', () => {
    for (const id of M5) expect(byId(id).id).toBe(id);
  });

  const ids: [string, number, string, string[]][] = [
    [
      'u07-forbidden',
      3,
      'lesson',
      [
        'forbidden-center',
        'forbidden-corner',
        'capture-exception',
        'trap-corner',
        'capture-corner',
        'tap-all-forbidden',
        'group-last-liberty',
      ],
    ],
    [
      'u08-ko',
      3,
      'lesson',
      [
        'tap-ko',
        'retake-edge',
        'start-ko',
        'ko-or-forbidden',
        'elsewhere-first',
        'find-threat',
        'after-threat',
      ],
    ],
    [
      'u09-ladder',
      3,
      'lesson',
      [
        'liberties-after',
        'first-atari',
        'chase-on',
        'finish',
        'ladder-breaker',
        'find-breaker',
        'corner-ladder',
      ],
    ],
    [
      'u09-review',
      0,
      'checkpoint',
      [
        'r-forbidden',
        'r-capture-legal',
        'r-ko-retake',
        'r-count-group',
        'r-atari',
        'r-capture',
        'r-ladder-first',
        'r-ladder-breaker',
      ],
    ],
  ];
  it.each(ids)('AC 3: %s has %i steps, kind %s and the spec ids', (id, steps, kind, list) => {
    const lesson = byId(id);
    expect(lesson.explain?.length ?? 0).toBe(steps);
    expect(lesson.kind).toBe(kind);
    expect(lesson.exercises.map((e) => e.id)).toEqual(list);
  });

  // [lesson, exercise #, expected]: points (sets), choice index, or count value (§7 tables).
  const rows: [string, number, string[] | number | { index: number }][] = [
    ['u07-forbidden', 1, ['c3']],
    ['u07-forbidden', 2, ['a1']],
    ['u07-forbidden', 3, { index: 0 }],
    ['u07-forbidden', 4, { index: 1 }],
    ['u07-forbidden', 5, ['e5']],
    ['u07-forbidden', 6, ['a1', 'd4', 'g7']],
    ['u07-forbidden', 7, { index: 1 }],
    ['u08-ko', 1, ['c4']],
    ['u08-ko', 2, { index: 1 }],
    ['u08-ko', 3, ['c3']],
    ['u08-ko', 4, { index: 1 }],
    ['u08-ko', 5, { index: 0 }],
    ['u08-ko', 6, ['g6', 'f7']],
    ['u08-ko', 7, { index: 0 }],
    ['u09-ladder', 1, 2],
    ['u09-ladder', 2, { index: 0 }],
    ['u09-ladder', 3, ['a3', 'b4']],
    ['u09-ladder', 4, ['e5']],
    ['u09-ladder', 5, { index: 1 }],
    ['u09-ladder', 6, ['f5']],
    ['u09-ladder', 7, { index: 0 }],
    ['u09-review', 1, ['b3']],
    ['u09-review', 2, { index: 0 }],
    ['u09-review', 3, { index: 1 }],
    ['u09-review', 4, 5],
    ['u09-review', 5, ['d4', 'e3']],
    ['u09-review', 6, ['b3']],
    ['u09-review', 7, { index: 0 }],
    ['u09-review', 8, { index: 1 }],
  ];
  it('AC 4: the table covers all 29 exercises', () => {
    expect(rows).toHaveLength(29);
    expect(M5.reduce((n, id) => n + byId(id).exercises.length, 0)).toBe(29);
  });
  it.each(rows)('AC 4: %s #%i', (id, n, expected) => {
    const solution = getSolution(exercise(id, n)) as {
      points?: string[];
      index?: number;
      value?: number;
    };
    if (Array.isArray(expected))
      expect([...(solution.points ?? [])].sort()).toEqual([...expected].sort());
    else if (typeof expected === 'number') expect(solution.value).toBe(expected);
    else expect(solution.index).toBe(expected.index);
  });

  it.each(M5)('AC 7: %s — hints, explanations and reasons', (id) => {
    for (const ex of byId(id).exercises) {
      const label = `${id}/${ex.id}`;
      if (ex.type === 'tap-point' || ex.type === 'play-move' || ex.type === 'count')
        expect({ label, hint: !!ex.hintKey }).toEqual({ label, hint: true });
      expect({ label, help: !!(ex.hintKey || ex.explainKey) }).toEqual({ label, help: true });
      if (ex.type === 'choice')
        for (const option of ex.options)
          if (!option.correct)
            expect({ label, why: !!option.whyKey }).toEqual({ label, why: true });
      if (ex.hintPoints && (ex.type === 'tap-point' || ex.type === 'play-move')) {
        const solution = getSolution(ex).points;
        expect(ex.hintPoints.filter((p) => !solution.includes(p))).toEqual([]);
      }
    }
  });

  it('AC 5: step texts are at most 135 characters in en and fr', () => {
    for (const id of M5)
      for (const step of byId(id).explain ?? [])
        for (const lang of ['en', 'fr'] as const) {
          const text = LESSON_TEXTS[lang][step.textKey] ?? '';
          expect({ key: step.textKey, lang, long: [...text].length > 135 }).toEqual({
            key: step.textKey,
            lang,
            long: false,
          });
        }
  });

  it('AC 6: unit titles 7–10 exist in all three languages', () => {
    for (const lang of ['zh-CN', 'en', 'fr'] as const)
      for (const n of [7, 8, 9, 10]) expect(LESSON_TEXTS[lang][`unit.${n}.title`]).toBeTruthy();
  });

  it('AC 8: the four files show coordinates', () => {
    for (const id of M5) expect(byId(id).coordinates).toBe(true);
  });
});

describe('C. Unit 7 — forbidden points (AC 15–17)', () => {
  it.each([
    ['u07-forbidden', 3, 'c3', 1],
    ['u09-review', 2, 'a5', 2],
  ] as const)('AC 15: %s #%i — A=%s is legal for Black and captures %i', (id, n, at, count) => {
    const result = play(startAs(exercise(id, n), 'B'), at);
    expect(result.ok).toBe(true);
    if (result.ok) expect(capturedCount(result.facts)).toBe(count);
    expect(getSolution(exercise(id, n))).toEqual({ index: 0 }); // "Yes, it captures"
  });

  it.each([
    ['u07-forbidden', 4, 'e1'],
    ['u07-forbidden', 7, 'a1'],
  ] as const)('AC 15: %s #%i — A=%s is suicide for Black', (id, n, at) => {
    expect(checkMove(startAs(exercise(id, n), 'B'), at)).toEqual({
      legal: false,
      reason: 'suicide',
    });
    expect(getSolution(exercise(id, n))).toEqual({ index: 1 }); // "No"
  });

  it('AC 15: e4 reasons — White d1 keeps c1, White e2 keeps e3; e7 — White a2-b2-c2 keeps 4', () => {
    const e4 = startAs(exercise('u07-forbidden', 4), 'B');
    expect(libs(e4, 'd1')).toEqual(['c1', 'e1']);
    expect(libs(e4, 'e2')).toEqual(['e1', 'e3']);
    const e7 = startAs(exercise('u07-forbidden', 7), 'B');
    expect(libs(e7, 'b1')).toEqual(['a1']);
    expect(libs(e7, 'a2')).toEqual(['a1', 'a3', 'b3', 'c3', 'd2']);
  });

  it.each([
    ['u07-forbidden', 1, ['c3']],
    ['u07-forbidden', 2, ['a1']],
    ['u07-forbidden', 6, ['a1', 'd4', 'g7']],
    ['u09-review', 1, ['b3']],
  ] as const)('AC 16: %s #%i — the answer is exactly the set of suicide points', (id, n, set) => {
    const ex = exercise(id, n);
    expect(illegalPoints(startAs(ex, 'B'), 'suicide')).toEqual([...set].sort());
    expect([...(getSolution(ex) as { points: Vertex[] }).points].sort()).toEqual([...set].sort());
  });

  it('AC 17: u07 e5 — e5 captures 2 and is the only capturing move', () => {
    const state = startAs(exercise('u07-forbidden', 5), 'B');
    expect(playMoveSolutions(state, { kind: 'capture' })).toEqual(['e5']);
    const result = play(state, 'e5');
    expect(result.ok && capturedCount(result.facts)).toBe(2);
  });

  it('AC 17: step 2 — Black a1 captures a2 and b1; step 3 — White e1 captures c1, d1; Black e1 is suicide', () => {
    const [s1, s2, s3] = byId('u07-forbidden').explain ?? [];
    expect(checkMove(startState(s1.board!), 'c3')).toEqual({ legal: false, reason: 'suicide' });
    const two = play(startState(s2.board!), 'a1');
    expect(
      two.ok &&
        two.facts.captured
          .flat()
          .map((p) => toVertex(p, 5))
          .sort(),
    ).toEqual(['a2', 'b1']);
    const board3 = s3.board!;
    expect(checkMove(startState(board3, 'B'), 'e1')).toEqual({ legal: false, reason: 'suicide' });
    const three = play(startState(board3, 'W'), 'e1');
    expect(
      three.ok &&
        three.facts.captured
          .flat()
          .map((p) => toVertex(p, 5))
          .sort(),
    ).toEqual(['c1', 'd1']);
  });
});

describe('C. Unit 8 — ko (AC 18–20)', () => {
  it('AC 18: e1 — after the prelude White c4 is ko', () => {
    const state = startState(exercise('u08-ko', 1));
    expect(state.toPlay).toBe('W');
    expect(checkMove(state, 'c4')).toEqual({ legal: false, reason: 'ko' });
    expect(illegalPoints(state, 'ko')).toEqual(['c4']);
  });

  it.each([
    ['u08-ko', 2, 'a3'],
    ['u09-review', 3, 'e3'],
  ] as const)('AC 18: %s #%i — A=%s is ko for White', (id, n, at) => {
    const state = startState(exercise(id, n));
    expect(state.toPlay).toBe('W');
    expect(checkMove(state, at)).toEqual({ legal: false, reason: 'ko' });
  });

  it("AC 18: e4 — c4 is suicide (not ko); Black's c2-c3 group has 4 liberties", () => {
    const state = startState(exercise('u08-ko', 4));
    expect(state.koPoint).toBeNull();
    expect(checkMove(state, 'c4')).toEqual({ legal: false, reason: 'suicide' });
    expect(libs(state, 'c3')).toEqual(['b2', 'c1', 'c4', 'd2']);
  });

  it.each([5, 7])('AC 18: e%i — White c4 is legal and captures c3', (n) => {
    const state = startState(exercise('u08-ko', n));
    expect(state.toPlay).toBe('W');
    const result = play(state, 'c4');
    expect(result.ok && result.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['c3']);
  });

  it('AC 19: e3 — c3 is the only solution and starts a ko on c4', () => {
    const ex = exercise('u08-ko', 3);
    expect(getSolution(ex)).toEqual({ points: ['c3'] });
    const result = play(startAs(ex, 'B'), 'c3');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.koPoint && toVertex(result.state.koPoint, 5)).toBe('c4');
    expect(checkMove(result.state, 'c4')).toEqual({ legal: false, reason: 'ko' });
  });

  it('AC 19: e6 — the threats are g6 and f7 (f6 has exactly those two liberties)', () => {
    const ex = exercise('u08-ko', 6);
    expect([...(getSolution(ex) as { points: Vertex[] }).points].sort()).toEqual(['f7', 'g6']);
    expect(libs(startState(ex), 'f6')).toEqual(['f7', 'g6']);
  });

  it('AC 19 / e7 reason: after B f7 the black group f6-f7 has liberties e7, g7', () => {
    expect(libs(startState(exercise('u08-ko', 7)), 'f7')).toEqual(['e7', 'g7']);
  });

  it('AC 20: step 3 line (B c3, W g6, B f7, W c4) replays and the last move captures c3', () => {
    const frames = explainFrames(byId('u08-ko'));
    const s3 = frames[2];
    expect(s3.moves).toHaveLength(4);
    const last = s3.moves[3];
    expect(toVertex(last.move, 7)).toBe('c4');
    expect(last.captured.map((p) => toVertex(p, 7))).toEqual(['c3']);
  });
});

describe('C. Unit 9 — ladder lines (AC 21–24)', () => {
  /** Each move of a working ladder: Black → 1 liberty; White → 2 (the last White move: 1). */
  function expectLadder(start: GameState, target: Vertex, line: Vertex[], captured: Vertex[]) {
    const states = replay(start, 'B', line);
    states.slice(0, -1).forEach(({ state }, i) => {
      const lastWhite = i === line.length - 2;
      const expected = i % 2 === 0 ? 1 : lastWhite ? 1 : 2;
      expect({ move: line[i], liberties: libs(state, target)?.length }).toEqual({
        move: line[i],
        liberties: expected,
      });
    });
    const end = states[states.length - 1];
    expect(end.captured).toBe(captured.length);
    for (const at of captured) expect(groupAt(end.state.board, at)).toBeNull();
  }

  it('AC 21: L1 (5×5) captures c3 d3 d4 e4 at the edge', () => {
    expectLadder(
      createPosition(5, ['b3', 'c2', 'd2'], ['c3']),
      'c3',
      ['c4', 'd3', 'e3', 'd4', 'd5', 'e4', 'e5'],
      ['c3', 'd3', 'd4', 'e4'],
    );
  });

  it('AC 22: review e7 (mirror) and u09 e7 (shifted +2/+2 on 7×7) follow the same pattern', () => {
    expectLadder(
      startState(exercise('u09-review', 7)),
      'c3',
      ['c4', 'b3', 'a3', 'b4', 'b5', 'a4', 'a5'],
      ['c3', 'b3', 'b4', 'a4'],
    );
    expectLadder(
      startState(exercise('u09-ladder', 7)),
      'e5',
      ['e6', 'f5', 'g5', 'f6', 'f7', 'g6', 'g7'],
      ['e5', 'f5', 'f6', 'g6'],
    );
  });

  it('AC 22: u09 s1 + s2 play L1, e4 is its end position before the capture', () => {
    const frames = explainFrames(byId('u09-ladder'));
    const line = [...frames[0].moves, ...frames[1].moves].map((m) => toVertex(m.move, 5));
    expect(line).toEqual(['c4', 'd3', 'e3', 'd4', 'd5', 'e4', 'e5']);
    const e4 = startState(exercise('u09-ladder', 4));
    const L1 = replay(createPosition(5, ['b3', 'c2', 'd2'], ['c3']), 'B', line.slice(0, 6));
    expect(e4.board.cells).toEqual(L1[5].state.board.cells);
  });

  it('AC 23: u09 e2 option B — after B d3, W c4 the group has b4, d4, c5', () => {
    const [, after] = replay(startState(exercise('u09-ladder', 2)), 'B', ['d3', 'c4']);
    expect(libs(after.state, 'c3')).toEqual(['b4', 'c5', 'd4']);
  });

  it('AC 23: review e7 option B — after B b3, W c4 the group has b4, d4, c5', () => {
    const [, after] = replay(startState(exercise('u09-review', 7)), 'B', ['b3', 'c4']);
    expect(libs(after.state, 'c3')).toEqual(['b4', 'c5', 'd4']);
  });

  it('AC 23: u09 step 3 and e5 — W e4 joins e5: 3 liberties f4, f5, e6', () => {
    const frames = explainFrames(byId('u09-ladder'));
    const s3 = frames[2];
    const empty = startState({ size: 7, setup: {} });
    const end = { ...empty, board: { ...empty.board, cells: endCells(s3) } };
    expect(libs(end, 'e4')).toEqual(['e6', 'f4', 'f5']);
    const states = replay(startState(exercise('u09-ladder', 5)), 'B', [
      'c4',
      'd3',
      'e3',
      'd4',
      'd5',
      'e4',
    ]);
    expect(libs(states[5].state, 'c3')).toEqual(['e6', 'f4', 'f5']);
    // The other atari (B e4 instead of d5) lets White d5 join e5 with at least 4 liberties.
    const other = replay(states[3].state, 'B', ['e4', 'd5']);
    expect(libs(other[1].state, 'c3')!.length).toBeGreaterThanOrEqual(4);
  });

  it('AC 23: u09 e6 — after B f4, W e5 joins f5: 3 liberties e6, f6, g5', () => {
    const states = replay(startState(exercise('u09-ladder', 6)), 'B', [
      'c4',
      'd3',
      'e3',
      'd4',
      'd5',
      'e4',
      'f4',
      'e5',
    ]);
    expect(libs(states[5].state, 'c3')).toEqual(['e5', 'f4']);
    expect(libs(states[7].state, 'c3')).toEqual(['e6', 'f6', 'g5']);
  });

  it('AC 23: review e8 (mirror of e5) — after W c4 the group has b4, b5, c6', () => {
    const states = replay(startState(exercise('u09-review', 8)), 'B', [
      'e4',
      'd3',
      'c3',
      'd4',
      'd5',
      'c4',
    ]);
    expect(libs(states[5].state, 'e3')).toEqual(['b4', 'b5', 'c6']);
  });

  it('AC 24: e1 = 2 (e3, d4); e6 b6 touches nothing on the path', () => {
    expect(libs(startState(exercise('u09-ladder', 1)), 'c3')).toEqual(['d4', 'e3']);
    // Without f5 (only b6) the same ladder works; without b6 (only f5) it fails.
    const onlyB6 = createPosition(7, ['b3', 'c2', 'd2', 'c4'], ['c3', 'b6']);
    const onlyF5 = createPosition(7, ['b3', 'c2', 'd2', 'c4'], ['c3', 'f5']);
    // The 7×7 chase runs to the far edge (8 Black + 7 White moves), hence 16 plies.
    expect(whiteEscapes({ ...onlyB6, toPlay: 'W' }, 'c3', 16)).toBe(false);
    expect(whiteEscapes({ ...onlyF5, toPlay: 'W' }, 'c3', PLIES)).toBe(true);
  });
});

describe('C. ladder search (AC 25, test-only, 12 plies)', () => {
  const after = (ex: Exercise, at: Vertex) => {
    const result = play(startAs(ex, 'B'), at);
    if (!result.ok) throw new Error(at);
    return result.state;
  };

  it.each([
    ['u09-ladder e2 (A = c4)', exercise('u09-ladder', 2), 'c4', 'c3'],
    ['u09-ladder e3 (a3)', exercise('u09-ladder', 3), 'a3', 'c3'],
    ['u09-ladder e3 (b4)', exercise('u09-ladder', 3), 'b4', 'c3'],
    ['u09-ladder e7 (e6)', exercise('u09-ladder', 7), 'e6', 'e5'],
    ['u09-review e7 (A = c4)', exercise('u09-review', 7), 'c4', 'c3'],
  ] as [string, Exercise, Vertex, Vertex][])(
    '%s: Black captures against every White reply',
    (_label, ex, at, target) => {
      expect(whiteEscapes(after(ex, at), target, PLIES)).toBe(false);
    },
  );

  it.each([
    ['u09-ladder e2 (B = d3)', exercise('u09-ladder', 2), 'd3', 'c3'],
    ['u09-ladder e5 (c4)', exercise('u09-ladder', 5), 'c4', 'c3'],
    ['u09-ladder e6 (c4)', exercise('u09-ladder', 6), 'c4', 'c3'],
    ['u09-review e7 (B = b3)', exercise('u09-review', 7), 'b3', 'c3'],
    ['u09-review e8 (e4)', exercise('u09-review', 8), 'e4', 'e3'],
  ] as [string, Exercise, Vertex, Vertex][])(
    '%s: the ladder chase (Black on the liberties only) does not capture within 12 plies',
    (_label, ex, at, target) => {
      expect(whiteEscapes(after(ex, at), target, PLIES)).toBe(true);
    },
  );
});

describe('E. stars, unlocks and flow (AC 31–35)', () => {
  const units = getUnits({ includeDev: false });
  const toSix = {
    'u01-board': 1,
    'u02-liberties': 1,
    'u03-connection': 1,
    'u04-capture': 1,
    'u05-atari': 1,
    'u06-capture-go': 1,
  };
  const run = (spec: [Outcome, number][]): Outcome[] =>
    spec.flatMap(([o, n]) => Array<Outcome>(n).fill(o));

  it.each([
    [
      [
        ['clean', 6],
        ['solved', 1],
      ],
      3,
    ],
    [
      [
        ['clean', 5],
        ['solved', 2],
      ],
      2,
    ],
    [
      [
        ['solved', 6],
        ['revealed', 1],
      ],
      2,
    ],
    [
      [
        ['solved', 4],
        ['revealed', 3],
      ],
      1,
    ],
    [
      [
        ['solved', 3],
        ['revealed', 4],
      ],
      0,
    ],
    [
      [
        ['clean', 7],
        ['solved', 1],
      ],
      3,
    ],
    [
      [
        ['clean', 6],
        ['solved', 2],
      ],
      2,
    ],
    [
      [
        ['solved', 7],
        ['revealed', 1],
      ],
      2,
    ],
    [
      [
        ['solved', 4],
        ['revealed', 4],
      ],
      1,
    ],
    [
      [
        ['solved', 3],
        ['revealed', 5],
      ],
      0,
    ],
  ] as [[Outcome, number][], number][])('AC 31: %j → %i★', (spec, expected) => {
    expect(computeStars(run(spec))).toBe(expected);
  });

  // Updated by M5 item 3: Unit 10 opens after 1★ on Unit 9; Unit 12 is the planned unit.
  it('AC 32: 1★ on 6 → 7, on 7 → 8, on 8 → 9; u09-review after 9 and never gates; 10 opens', () => {
    expect(isUnlocked(units, stars({ ...toSix, 'u06-capture-go': 0 }), 7)).toBe(false);
    expect(isUnlocked(units, stars(toSix), 7)).toBe(true);
    expect(isUnlocked(units, stars(toSix), 8)).toBe(false);
    const seven = { ...toSix, 'u07-forbidden': 1 };
    expect(isUnlocked(units, stars(seven), 8)).toBe(true);
    const eight = { ...seven, 'u08-ko': 1 };
    expect(isUnlocked(units, stars(eight), 9)).toBe(true);
    expect(isCheckpointUnlocked(units, stars(eight), 9)).toBe(false);
    const nine = { ...eight, 'u09-ladder': 1 };
    expect(isCheckpointUnlocked(units, stars(nine), 9)).toBe(true);
    const rows = mapRows(units, stars(nine)).map((r) => `${r.key}:${r.state}`);
    expect(rows.slice(-9)).toEqual([
      'unit-7:done',
      'unit-8:done',
      'unit-9:done',
      'checkpoint-9:available',
      'unit-10:available',
      'unit-11:locked',
      'lesson-u11-vital:locked',
      'checkpoint-11:locked',
      'unit-12:soon',
    ]);
  });

  // Updated by M5 item 3: Units 10–11 ship, Unit 12 is planned.
  it('AC 33: production units 1–9 have a lesson, 9 a checkpoint, then 10–11, 12 planned', () => {
    expect(PLANNED_UNITS).toEqual([12]);
    expect(units.map((u) => u.unit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(
      units.slice(6).map((u) => [u.unit, u.lesson?.id ?? null, u.checkpoint?.id ?? null]),
    ).toEqual([
      [7, 'u07-forbidden', null],
      [8, 'u08-ko', null],
      [9, 'u09-ladder', 'u09-review'],
      [10, 'u10-eyes', null],
      [11, 'u11-two-eyes', 'u11-review'],
      [12, null, null],
    ]);
  });

  // Updated by M5 item 3: after u09-review comes Unit 10.
  it('AC 34: Next after u08-ko → u09-ladder → u09-review → u10-eyes', () => {
    const all = stars({
      ...toSix,
      'u05-review': 1,
      'u06-checkpoint': 1,
      'u07-forbidden': 1,
      'u08-ko': 1,
      'u09-ladder': 1,
    });
    expect(nodeAfter(units, all, 'u07-forbidden')?.lesson.id).toBe('u08-ko');
    expect(nodeAfter(units, all, 'u08-ko')?.lesson.id).toBe('u09-ladder');
    expect(nodeAfter(units, all, 'u09-ladder')?.lesson.id).toBe('u09-review');
    expect(nodeAfter(units, all, 'u09-review')?.lesson.id).toBe('u10-eyes');
  });

  it('AC 35: everything with ≥ 1★ → nothing left to continue', () => {
    const all = Object.fromEntries(
      units
        .flatMap((u) => [u.lesson, ...(u.laterLessons ?? []), u.checkpoint])
        .flatMap((l) => (l ? [[l.id, 1]] : [])),
    );
    expect(nextNode(units, stars(all))).toBeNull();
  });
});

describe('F. text rules (AC 36)', () => {
  const keysOf = (lesson: Lesson): string[] => {
    const keys: string[] = [];
    JSON.stringify(lesson, (name, value) => {
      if (/Key$/.test(name) && typeof value === 'string') keys.push(value);
      return value;
    });
    return keys;
  };
  const toneMarked = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

  it.each(M5)('%s zh-CN texts contain no pinyin', (id) => {
    for (const key of keysOf(byId(id)))
      expect({ key, pinyin: toneMarked.test(LESSON_TEXTS['zh-CN'][key] ?? '') }).toEqual({
        key,
        pinyin: false,
      });
  });

  it.each([
    ['lesson.u07-forbidden.s1', '禁入点', 'jìnrùdiǎn'],
    ['lesson.u08-ko.s2', '打劫', 'dǎjié'],
    ['lesson.u08-ko.s3', '劫材', 'jiécái'],
    ['lesson.u09-ladder.s1', '征子', 'zhēngzi'],
  ])('%s introduces %s %s in en and fr', (key, hanzi, pinyin) => {
    for (const lang of ['en', 'fr'] as const)
      expect(LESSON_TEXTS[lang][key]).toContain(`${hanzi} ${pinyin}`);
  });
});
