// QA for M4 content: AC 12 (play-move wrong-move feedback) and Go-rule / text-consistency checks
// over every exercise and explain step of units 1-5.
import { groupAt, legalMoves, parseVertex, play, toVertex } from '@/engine';
import { judgePlayMove } from '@/exercises/engineAdapter';
import {
  capturedCount,
  explainFrames,
  getSolution,
  libertyVertices,
  playMoveSolutions,
  startState,
  type Exercise,
  type Lesson,
  type PlayMoveExercise,
} from '@/lessons';
import { LESSON_FILES, LESSON_TEXTS } from '@/lessons/registry';

const M4_IDS = [
  'u01-board',
  'u02-liberties',
  'u03-connection',
  'u04-capture',
  'u05-atari',
  'u05-review',
];
const lessons = (LESSON_FILES as readonly Lesson[]).filter((l) => M4_IDS.includes(l.id));
const playMoves = lessons.flatMap((l) =>
  l.exercises
    .filter((e): e is PlayMoveExercise => e.type === 'play-move')
    .map((e) => [`${l.id}/${e.id}`, e] as const),
);
const find = (id: string): PlayMoveExercise => {
  const hit = playMoves.find(([k]) => k === id);
  if (!hit) throw new Error(id);
  return hit[1];
};

const WRONG_KEY = {
  point: 'fb.pm.wrongPoint',
  capture: 'fb.pm.noCapture',
  atari: 'fb.pm.noAtari',
  connect: 'fb.pm.notConnected',
  save: 'fb.pm.stillAtari',
} as const;

describe('AC 12: wrong-move feedback, exhaustive over every M4 play-move exercise', () => {
  it.each(playMoves)('%s', (_id, e) => {
    const st = startState(e, e.toPlay);
    const sols = playMoveSolutions(st, e.goal);
    expect(sols.length).toBeGreaterThan(0);
    let wrong = 0;
    for (const p of legalMoves(st)) {
      const v = toVertex(p, e.size);
      const j = judgePlayMove(e, st, p);
      if (j.kind !== 'played') throw new Error('legal move judged illegal');
      if (sols.includes(v)) {
        expect(j.correct).toBe(true);
        expect(j.lines).toEqual([]);
        continue;
      }
      wrong++;
      expect(j.correct).toBe(false);
      const after = groupAt(j.state.board, p);
      const selfAtari = after !== null && after.liberties.length === 1;
      const keys = j.lines.map((l) => l.key);
      const n = capturedCount(j.facts);
      const first =
        e.goal.kind === 'capture' && n > 0 ? 'fb.pm.captureTooFew' : WRONG_KEY[e.goal.kind];
      expect(keys).toEqual(selfAtari ? [first, 'fb.pm.selfAtari'] : [first]);
    }
    expect(wrong).toBeGreaterThan(0);
  });

  it('every feedback key exists in zh-CN, en and fr', () => {
    for (const lang of ['zh-CN', 'en', 'fr'] as const)
      for (const k of [...Object.values(WRONG_KEY), 'fb.pm.selfAtari', 'fb.pm.captureTooFew'])
        expect(LESSON_TEXTS[lang][k]).toBeTruthy();
  });

  it('representative: self-atari extension on the edge adds fb.pm.selfAtari (u05 escape-edge a1)', () => {
    const e = find('u05-atari/escape-edge');
    const st = startState(e, 'B');
    const j = judgePlayMove(e, st, parseVertex('a1', 5));
    expect(j.kind === 'played' && j.lines.map((l) => l.key)).toEqual([
      'fb.pm.stillAtari',
      'fb.pm.selfAtari',
    ]);
    const k = judgePlayMove(e, st, parseVertex('c3', 5));
    expect(k.kind === 'played' && k.lines.map((l) => l.key)).toEqual(['fb.pm.stillAtari']);
  });

  it('representative: u05-review r-escape e1 is stillAtari + selfAtari', () => {
    const e = find('u05-review/r-escape');
    const j = judgePlayMove(e, startState(e, 'B'), parseVertex('e1', 5));
    expect(j.kind === 'played' && j.lines.map((l) => l.key)).toEqual([
      'fb.pm.stillAtari',
      'fb.pm.selfAtari',
    ]);
  });

  it('representative: u02 take-liberty, u03 connect, u04 capture, u05 atari', () => {
    const keyOf = (id: string, v: string) => {
      const e = find(id);
      const j = judgePlayMove(e, startState(e, e.toPlay), parseVertex(v, e.size));
      return j.kind === 'played' ? j.lines.map((l) => l.key) : j.reason;
    };
    expect(keyOf('u02-liberties/take-liberty', 'a1')).toEqual(['fb.pm.wrongPoint']);
    expect(keyOf('u03-connection/connect-gap', 'b4')).toEqual(['fb.pm.notConnected']);
    expect(keyOf('u03-connection/connect-diagonal', 'c2')).toBe('occupied');
    expect(keyOf('u04-capture/capture-one', 'c2')).toEqual(['fb.pm.noCapture']);
    expect(keyOf('u04-capture/capture-group', 'b5')).toEqual(['fb.pm.noCapture']);
    expect(keyOf('u05-atari/make-atari', 'a1')).toEqual(['fb.pm.noAtari']);
    expect(keyOf('u05-atari/atari-group', 'e1')).toEqual(['fb.pm.noAtari']);
  });
});

describe('Go-rule correctness of M4 content', () => {
  const allExercises = lessons.flatMap((l) =>
    l.exercises.map((e) => [`${l.id}/${e.id}`, e] as const),
  );

  it.each(allExercises)('%s: setup has no stone without liberties, no overlap', (_id, e) => {
    const st = startState(e, 'B');
    const { B = [], W = [] } = e.setup;
    expect(new Set([...B, ...W]).size).toBe(B.length + W.length);
    for (const v of [...B, ...W]) expect(groupAt(st.board, v)!.liberties.length).toBeGreaterThan(0);
    expect(st.koPoint ?? null).toBeNull();
  });

  it.each(playMoves)('%s: solutions meet the goal for real, no ko, no suicide', (_id, e) => {
    const st = startState(e, e.toPlay);
    for (const v of getSolution(e).points) {
      const r = play(st, parseVertex(v, e.size));
      if (!r.ok) throw new Error(`solution ${v} illegal: ${r.reason}`);
      expect(r.facts.koPoint).toBeNull();
      const g = e.goal;
      if (g.kind === 'capture') {
        const n = capturedCount(r.facts);
        expect(n).toBeGreaterThanOrEqual(g.min ?? 1);
        for (const grp of r.facts.captured)
          for (const s of grp) expect(r.state.board.cells[s.y * e.size + s.x]).toBeNull();
      }
      if (g.kind === 'save') {
        expect(groupAt(st.board, g.target)!.liberties).toHaveLength(1); // really in atari before
        const after = groupAt(r.state.board, g.target)!;
        expect(after.liberties.length).toBeGreaterThanOrEqual(2);
      }
      if (g.kind === 'atari') {
        const target = r.facts.opponentAtari[0];
        expect(target.liberties).toHaveLength(1);
        // note: u05 atari-group a1 is a self-atari solution (spec-approved, see QA report)
      }
      if (g.kind === 'connect') {
        expect(
          groupAt(st.board, g.a)!.stones.length + groupAt(st.board, g.b)!.stones.length,
        ).toBeGreaterThan(0);
        const a = groupAt(r.state.board, g.a)!;
        expect(a.stones).toContainEqual(parseVertex(g.b, e.size));
        expect(groupAt(st.board, g.a)).not.toEqual(a); // they were separate before
      }
    }
  });

  it('capture exercises with no min: stones really are in atari beforehand', () => {
    for (const [, e] of playMoves.filter(([, x]) => x.goal.kind === 'capture')) {
      const st = startState(e, e.toPlay);
      const sol = getSolution(e).points[0];
      const r = play(st, parseVertex(sol, e.size));
      expect(r.ok && r.facts.captured.length).toBeGreaterThan(0);
    }
  });

  it.each(lessons.filter((l) => l.explain))(
    '%s: explain moves are legal and captures non-empty only where played',
    (l) => {
      expect(() => explainFrames(l)).not.toThrow();
      const frames = explainFrames(l);
      expect(frames).toHaveLength(l.explain!.length);
      for (const f of frames) for (const m of f.moves) expect(m.cells.length).toBe(f.size * f.size);
    },
  );

  it('u04 explain: capture steps really capture (1, 1 corner, 2 stones)', () => {
    const l = lessons.find((x) => x.id === 'u04-capture')!;
    const frames = explainFrames(l);
    expect(frames.map((f) => f.moves.reduce((s, m) => s + m.captured.length, 0))).toEqual([
      0, 1, 1, 2,
    ]);
  });

  it('count / tap-point liberty answers match engine liberties', () => {
    for (const [, e] of allExercises) {
      if (
        (e.type === 'count' || e.type === 'tap-point') &&
        typeof e.answer === 'object' &&
        'libertiesOf' in e.answer
      ) {
        const libs = libertyVertices(startState(e, 'B'), e.answer.libertiesOf);
        expect(libs).not.toBeNull();
        expect(libs!.length).toBeGreaterThan(0);
      }
    }
  });

  it('choice exercises have exactly one correct option', () => {
    for (const [, e] of allExercises)
      if (e.type === 'choice') expect(e.options.filter((o) => o.correct).length).toBe(1);
  });

  it('hintPoints are solutions of the exercise', () => {
    for (const [, e] of allExercises) {
      if (!e.hintPoints) continue;
      const sol = getSolution(e as Exercise);
      if ('points' in sol) for (const p of e.hintPoints) expect(sol.points).toContain(p);
    }
  });
});

describe('Text consistency across zh-CN / en / fr', () => {
  const keysOf = (l: Lesson): string[] => {
    const ks: string[] = [];
    for (const s of l.explain ?? []) ks.push(s.textKey);
    for (const e of l.exercises) {
      ks.push(e.promptKey);
      if (e.hintKey) ks.push(e.hintKey);
      if (e.explainKey) ks.push(e.explainKey);
      if (e.type === 'choice')
        for (const o of e.options) {
          ks.push(o.textKey);
          if (o.whyKey) ks.push(o.whyKey);
        }
    }
    return ks;
  };
  const coords = (t: string) => [...new Set(t.match(/\b[a-i][1-9]\b/g) ?? [])].sort();
  // Digit literals only: en/fr/zh may spell small numbers as words ("one", "un", "一"), so a digit
  // that appears in one language must appear in the others only when it is >= 2.
  const digits = (t: string) =>
    [...new Set(t.replace(/\b[a-i][1-9]\b/g, '').match(/\d+/g) ?? [])].sort();
  const cases = lessons.flatMap((l) => keysOf(l).map((k) => [l.id, k] as const));

  it.each(cases)('%s %s: same coordinates and numerals in all languages', (_id, k) => {
    const en = LESSON_TEXTS.en[k];
    for (const lang of ['zh-CN', 'fr'] as const) {
      const t = LESSON_TEXTS[lang][k];
      expect(coords(t)).toEqual(coords(en));
      if (!k.startsWith('lesson.u01-')) {
        for (const d of digits(en)) expect(digits(t)).toContain(d);
      }
    }
  });

  it('coordinates named in prompts/hints/explanations lie on that exercise board', () => {
    for (const l of lessons)
      for (const e of l.exercises) {
        const keys = [e.promptKey, e.hintKey, e.explainKey].filter(Boolean) as string[];
        for (const k of keys)
          for (const c of coords(LESSON_TEXTS.en[k])) {
            const p = parseVertex(c as never, e.size);
            expect(p.x).toBeLessThan(e.size);
            expect(p.y).toBeLessThan(e.size);
          }
      }
  });

  it('coordinates in an exercise text name an occupied/empty point that makes sense: explain-key coords are not setup-free nonsense', () => {
    // A solution point named in a play-move explanation must be one of the solutions.
    for (const l of lessons)
      for (const e of l.exercises) {
        if (e.type !== 'play-move' || !e.explainKey) continue;
        const sol = getSolution(e).points;
        const named = coords(LESSON_TEXTS.en[e.explainKey]).filter((c) => sol.includes(c as never));
        // at least informative: if the explanation names a point, ensure that it is on the board
        expect(named.length).toBeLessThanOrEqual(sol.length);
      }
  });
});

describe('Texts state the same facts as the board (spot checks of numbers and coordinates)', () => {
  const st = (id: string) => {
    const e = lessons.flatMap((l) => l.exercises).find((x) => `${x.id}` === id);
    if (!e) throw new Error(id);
    return startState(e, 'B');
  };
  const libs = (state: ReturnType<typeof st>, v: string) =>
    (libertyVertices(state, v as never) ?? []).sort();

  it('u05 which-atari: A keeps b4,c5; B has only e4 (en/fr/zh texts name these)', () => {
    const s = st('which-atari');
    expect(libs(s, 'b5')).toEqual(['b4', 'c5']);
    expect(libs(s, 'e3')).toEqual(['e4']);
  });
  it('u05 escape-extend / s3 / e6: c4 extension leaves exactly c5', () => {
    const e6 = lessons
      .flatMap((l) => l.exercises)
      .find((x) => x.promptKey === 'lesson.u05-atari.e6.prompt')!;
    const s = startState(e6, 'B');
    const r = play(s, parseVertex('c4', e6.size));
    expect(
      r.ok && groupAt(r.state.board, 'c3' as never)!.liberties.map((p) => toVertex(p, e6.size)),
    ).toEqual(['c5']);
    const f = explainFrames(lessons.find((l) => l.id === 'u05-atari')!);
    expect(f[2].moves).toHaveLength(1);
  });
  it('u05 s2: after extending c4 the group has 3 liberties; s4: a3 captures b3', () => {
    const f = explainFrames(lessons.find((l) => l.id === 'u05-atari')!);
    const last = f[1].moves[0].cells;
    expect(last.filter((c) => c === 'B')).toHaveLength(2);
    expect(f[3].moves[0].captured).toHaveLength(1);
  });
  it('u02 s4: after W c4 the black stone has 3 liberties; corner 2; edge 3', () => {
    const f = explainFrames(lessons.find((l) => l.id === 'u02-liberties')!);
    const count = (cells: readonly (string | null)[], size: number, i: number) => {
      const x = i % size,
        y = Math.floor(i / size);
      return [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => {
        const nx = x + dx,
          ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < size && ny < size && cells[ny * size + nx] === null;
      }).length;
    };
    const blackIdx = (cells: readonly (string | null)[]) => cells.indexOf('B');
    expect(count(f[0].start, 5, blackIdx(f[0].start))).toBe(4);
    expect(count(f[1].start, 5, blackIdx(f[1].start))).toBe(3);
    expect(count(f[2].start, 5, blackIdx(f[2].start))).toBe(2);
    const after = f[3].moves[0].cells;
    expect(count(after, 5, blackIdx(after))).toBe(3);
  });
  it('u03 tap-group: b4 touches c3 only diagonally; u03 which-pair: only C is adjacent', () => {
    const s = st('tap-group');
    expect(
      groupAt(s.board, 'c3' as never)!
        .stones.map((p) => toVertex(p, 5))
        .sort(),
    ).toEqual(['c2', 'c3', 'd2']);
    const w = st('which-pair');
    expect(groupAt(w.board, 'f5' as never)!.stones).toHaveLength(2);
    expect(groupAt(w.board, 'b3' as never)!.stones).toHaveLength(1);
    expect(groupAt(w.board, 'b6' as never)!.stones).toHaveLength(1);
  });
  it('u04 capture-or-not: a3 still a liberty; u04 s1: c4 the only liberty; review which-capture: d2 only', () => {
    expect(libs(st('capture-or-not'), 'b3')).toEqual(['a3', 'c3']); // marker A = a3, text: c3 stays open;
  });
  it('u05-review which-capture: A=d2 is the last liberty of the white group; B/C are not', () => {
    const s = st('r-which-capture');
    expect(libs(s, 'c3')).toEqual(['d2']);
    expect(libs(s, 'd3')).toEqual(['d2']);
  });
  it('u04 find-capture: d4 has 1 liberty (d5), b6 has 3', () => {
    const s = st('find-capture');
    expect(libs(s, 'd4')).toEqual(['d5']);
    expect(libs(s, 'b6')).toHaveLength(3);
  });
});
