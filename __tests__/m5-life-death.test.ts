// M5 item 3 — Units 10–11 (eyes, life and death) + checkpoint u11-review.
// Acceptance criteria A–B of docs/specs/M5-life-death.md §4 (content and its engine proof).
// The runner ACs are in src/exercises/sequence.test.ts and __tests__/app/practice-sequence.test.tsx.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkMove, legalMoves, play, toVertex, type GameState, type Vertex } from '@/engine';
import {
  PLANNED_UNITS,
  getSolution,
  getUnits,
  mapRows,
  playMoveSolutions,
  startState,
  validateCatalog,
  validateLesson,
  type ChoiceExercise,
  type Exercise,
  type Lesson,
  type SequenceExercise,
} from '@/lessons';
import { canForceCapture, libertyCount } from '@/lessons/__fixtures__/lifeDeath';
import { playAs } from '@/lessons/goals';
import { hasTextIn } from '@/lessons/loader';
import { LESSON_FILES, LESSON_TEXTS } from '@/lessons/registry';

import { buildLesson, formatLessonJson, REPO_ROOT } from '../scripts/import-sgf';

const lessons = LESSON_FILES as readonly Lesson[];
const byId = (id: string): Lesson => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
};
const IDS = ['u10-eyes', 'u11-two-eyes', 'u11-vital', 'u11-review'] as const;
const ex = (lessonId: string, id: string): Exercise => {
  const found = byId(lessonId).exercises.find((e) => e.id === id);
  if (!found) throw new Error(`missing ${lessonId}/${id}`);
  return found;
};
const seq = (lessonId: string, id: string) => ex(lessonId, id) as SequenceExercise;

/** The start of an exercise with `color` to move. */
function startAs(exercise: Exercise, color: 'B' | 'W'): GameState {
  const state = startState(exercise);
  return state.toPlay === color ? state : { ...state, toPlay: color, koPoint: null };
}
function after(state: GameState, color: 'B' | 'W', at: Vertex): GameState {
  const result = playAs(state, color, at);
  if (!result.ok) throw new Error(`${color} ${at}: ${result.reason}`);
  return result.state;
}
const passed = (state: GameState): GameState => ({
  ...state,
  toPlay: state.toPlay === 'B' ? 'W' : 'B',
  koPoint: null,
});
/** Every reply of the side to move: each legal point and a pass. */
function replies(state: GameState): { at: string; state: GameState }[] {
  const list = [{ at: 'pass', state: passed(state) }];
  for (const p of legalMoves(state)) {
    const result = play(state, p);
    if (result.ok) list.push({ at: toVertex(p, state.board.size), state: result.state });
  }
  return list;
}
/** Black cannot be captured with White to move within `plies` (the group lives). */
const lives = (state: GameState, target: Vertex, plies = 6) =>
  !canForceCapture(state, target, plies);

describe('A. files and validity (AC 1–8)', () => {
  it('AC 1: the four lessons are registered and named after their id', () => {
    for (const id of IDS) expect(byId(id).id).toBe(id);
  });

  it.each(['u11-vital', 'u11-review'])(
    'AC 1: %s comes from content-src and import:sgf reproduces it byte for byte',
    (id) => {
      const result = buildLesson(join(REPO_ROOT, 'content-src', `${id}.src.json`), {
        hasText: hasTextIn(LESSON_TEXTS),
      });
      expect(result.ok ? [] : result.errors).toEqual([]);
      if (!result.ok) return;
      expect(byId(id).generatedFrom).toBe(`content-src/${id}.src.json`);
      const committed = readFileSync(
        join(REPO_ROOT, 'src', 'lessons', 'content', `${id}.json`),
        'utf8',
      );
      expect(formatLessonJson(result.lesson, id)).toBe(committed);
    },
  );

  it.each(['u10-eyes', 'u11-two-eyes'])('AC 1: %s is hand JSON (no generatedFrom)', (id) => {
    expect(byId(id).generatedFrom).toBeUndefined();
  });

  it.each(IDS)('AC 2: %s validates with the real texts', (id) => {
    const result = validateLesson(byId(id), { hasText: hasTextIn(LESSON_TEXTS) });
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('AC 2: the catalog is consistent; Units 1–11 have a lesson, Unit 12 is planned', () => {
    expect(validateCatalog([...lessons])).toEqual({ ok: true });
    const units = getUnits({ includeDev: false });
    expect(units.filter((u) => u.lesson).map((u) => u.unit)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(units.filter((u) => !u.lesson).map((u) => u.unit)).toEqual([12]);
  });

  it('AC 3: steps 3/3/3/0, exercises 6/6/6/7 with the ids of §7', () => {
    expect(IDS.map((id) => byId(id).explain?.length ?? 0)).toEqual([3, 3, 3, 0]);
    expect(IDS.map((id) => byId(id).exercises.map((e) => e.id))).toEqual([
      ['find-eye', 'real-corner', 'false-edge', 'which-real', 'weak-stone', 'capture-cutter'],
      ['count-eyes', 'one-eye', 'make-two', 'cannot-play', 'one-big-eye', 'after-vital'],
      [
        'live-straight',
        'kill-straight',
        'live-bent',
        'kill-bent-tap',
        'kill-bent',
        'straight-four',
      ],
      ['r-find-eye', 'r-false', 'r-count', 'r-capture', 'r-cannot', 'r-atari', 'r-kill'],
    ]);
    expect(byId('u11-review').kind).toBe('checkpoint');
  });

  it('AC 3: exactly three sequence exercises ship', () => {
    const found = lessons.flatMap((l) =>
      l.exercises.filter((e) => e.type === 'sequence').map((e) => e.id),
    );
    expect(found).toEqual(['kill-straight', 'kill-bent', 'r-kill']);
  });

  const choice = (i: number) => ({ index: i });
  it.each([
    ['u10-eyes', 'find-eye', { points: ['c1'] }],
    ['u10-eyes', 'real-corner', choice(0)],
    ['u10-eyes', 'false-edge', choice(1)],
    ['u10-eyes', 'which-real', choice(0)],
    ['u10-eyes', 'weak-stone', { points: ['d1'] }],
    ['u10-eyes', 'capture-cutter', { points: ['b3'] }],
    ['u11-two-eyes', 'count-eyes', { value: 2 }],
    ['u11-two-eyes', 'one-eye', choice(0)],
    ['u11-two-eyes', 'make-two', { points: ['b1'] }],
    ['u11-two-eyes', 'cannot-play', { points: ['a1', 'c1'] }],
    ['u11-two-eyes', 'one-big-eye', { value: 1 }],
    ['u11-two-eyes', 'after-vital', choice(1)],
    ['u11-vital', 'live-straight', { points: ['b1'] }],
    ['u11-vital', 'kill-straight', { points: ['b1'] }],
    ['u11-vital', 'live-bent', { points: ['a1'] }],
    ['u11-vital', 'kill-bent-tap', { points: ['a1'] }],
    ['u11-vital', 'kill-bent', { points: ['e1'] }],
    ['u11-vital', 'straight-four', choice(1)],
    ['u11-review', 'r-find-eye', { points: ['e1'] }],
    ['u11-review', 'r-false', choice(1)],
    ['u11-review', 'r-count', { value: 2 }],
    ['u11-review', 'r-capture', { points: ['c2'] }],
    ['u11-review', 'r-cannot', choice(1)],
    ['u11-review', 'r-atari', { points: ['c2', 'c4'] }],
    ['u11-review', 'r-kill', { points: ['b5'] }],
  ] as const)('AC 4: %s/%s → %j', (lessonId, id, solution) => {
    expect(getSolution(ex(lessonId, id))).toEqual(solution);
  });

  it('AC 6: wrong options have a whyKey; sequences have hint/explain/whyKeys; coordinates on', () => {
    for (const id of IDS) {
      const lesson = byId(id);
      expect(lesson.coordinates).toBe(true);
      for (const e of lesson.exercises) {
        if (e.type === 'choice') {
          for (const option of e.options.filter((o) => !o.correct)) {
            expect({ id: e.id, why: option.whyKey !== undefined }).toEqual({ id: e.id, why: true });
          }
        }
        if (e.type === 'sequence') {
          expect(e.hintKey).toBeDefined();
          expect(e.explainKey).toBeDefined();
          expect(e.wrong?.length).toBe(2);
          for (const branch of e.wrong ?? []) expect(branch.whyKey).toBeDefined();
        }
        const solution = getSolution(e);
        if ('points' in solution) {
          for (const p of e.hintPoints ?? []) expect(solution.points).toContain(p);
        }
      }
    }
  });

  it('AC 7: PLANNED_UNITS = [12]; the map shows Unit 12 as coming soon', () => {
    expect(PLANNED_UNITS).toEqual([12]);
    const rows = mapRows(getUnits({ includeDev: false }), {});
    expect(rows.slice(-5).map((r) => `${r.key}:${r.state}`)).toEqual([
      'unit-10:locked',
      'unit-11:locked',
      'lesson-u11-vital:locked',
      'checkpoint-11:locked',
      'unit-12:soon',
    ]);
  });
});

describe('A. texts (AC 5, 34)', () => {
  const keysOf = (lesson: Lesson): string[] => {
    const keys: string[] = [];
    JSON.stringify(lesson, (name, value) => {
      if (/Key$/.test(name) && typeof value === 'string') keys.push(value);
      return value;
    });
    return keys;
  };
  const stepKeys = new Set(IDS.flatMap((id) => (byId(id).explain ?? []).map((s) => s.textKey)));
  const sequenceKeys = Object.keys(LESSON_TEXTS.en).filter((k) => k.startsWith('sequence.'));
  const keys = [
    ...new Set([
      ...IDS.flatMap((id) => keysOf(byId(id))),
      ...sequenceKeys,
      'unit.10.title',
      'unit.11.title',
      'unit.12.title',
    ]),
  ];

  it.each(keys)('%s exists in zh-CN, en and fr within the limits', (key) => {
    for (const lang of ['zh-CN', 'en', 'fr'] as const) {
      const text = LESSON_TEXTS[lang][key];
      expect({ key, lang, defined: typeof text === 'string' }).toEqual({
        key,
        lang,
        defined: true,
      });
      const limit = lang === 'zh-CN' ? 70 : stepKeys.has(key) ? 135 : 160;
      expect({ key, lang, length: [...text].length <= limit }).toEqual({
        key,
        lang,
        length: true,
      });
    }
  });

  it('AC 5: the sequence keys of §5.4 exist', () => {
    expect(sequenceKeys.sort()).toEqual(
      [
        'sequence.a11y.plays.B',
        'sequence.a11y.plays.W',
        'sequence.answer',
        'sequence.captured_one',
        'sequence.captured_other',
        'sequence.done',
        'sequence.progress',
        'sequence.replies.B',
        'sequence.replies.W',
        'sequence.undo',
        'sequence.wrong.liberties_one',
        'sequence.wrong.liberties_other',
        'sequence.wrong.notLine',
        'sequence.wrong.refuted',
        'sequence.yourTurn',
      ].sort(),
    );
  });

  it('AC 34: zh-CN has no pinyin in any new text', () => {
    for (const key of keys) {
      const text = LESSON_TEXTS['zh-CN'][key].replace(/\{\{\w+\}\}/g, '');
      expect({ key, pinyin: /[a-zà-ǜ]{2,}/i.test(text) }).toEqual({ key, pinyin: false });
    }
  });

  it.each([
    ['眼 yǎn', 'lesson.u10-eyes.s1'],
    ['假眼 jiǎyǎn', 'lesson.u10-eyes.s2'],
    ['真眼 zhēnyǎn', 'lesson.u10-eyes.s3'],
    ['两眼 liǎngyǎn', 'lesson.u11-two-eyes.s2'],
    ['活 huó', 'lesson.u11-two-eyes.s3'],
    ['死 sǐ', 'lesson.u11-two-eyes.s3'],
    ['死活 sǐhuó', 'lesson.u11-two-eyes.s3'],
    ['要点 yàodiǎn', 'lesson.u11-vital.s1'],
    ['死活 sǐhuó', 'unit.11.title'],
    ['地 dì', 'unit.12.title'],
  ])('AC 34 / §8: en and fr give "%s" in %s', (term, key) => {
    expect(LESSON_TEXTS.en[key]).toContain(term);
    expect(LESSON_TEXTS.fr[key]).toContain(term);
  });
});

describe('B. sequences proved by the engine (AC 9–12)', () => {
  const SEQUENCES = [
    ['u11-vital', 'kill-straight', ['a1', 'b1', 'c1']],
    ['u11-vital', 'kill-bent', ['e1', 'd1', 'e2']],
    ['u11-review', 'r-kill', ['a5', 'b5', 'c5']],
  ] as const;

  it.each(SEQUENCES)('AC 9: %s/%s — legal, alternating, captures the 6-stone group', (l, id) => {
    const e = seq(l, id);
    let state = startState(e, e.toPlay);
    const target = (e.goal as { target: Vertex }).target;
    let captured: Vertex[] = [];
    e.line.forEach((move, i) => {
      expect(move.color).toBe(i % 2 === 0 ? e.toPlay : e.toPlay === 'B' ? 'W' : 'B');
      const result = play(state, move.at);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      captured = result.facts.captured.flat().map((p) => toVertex(p, e.size));
      state = result.state;
    });
    expect(captured).toContain(target);
    expect(captured).toHaveLength(6);
    expect(captured).toContain(e.line[1].at); // the scripted reply stone is part of it
  });

  it.each(SEQUENCES)(
    'AC 10: %s/%s — after each wrong branch White cannot capture within 6 plies',
    (l, id) => {
      const e = seq(l, id);
      const target = (e.goal as { target: Vertex }).target;
      for (const branch of e.wrong ?? []) {
        let state = startState(e, e.toPlay);
        for (const move of branch.line) {
          const result = play(state, move.at);
          expect(result.ok).toBe(true);
          if (result.ok) state = result.state;
        }
        expect({ branch: branch.line[0].at, lives: lives(state, target, 6) }).toEqual({
          branch: branch.line[0].at,
          lives: true,
        });
      }
    },
  );

  // §12b: the spec said "within 4 further plies"; after a Black pass (or a move elsewhere) the
  // engine needs 5 (W, B, W, B, W): White makes a 2-point false eye area first, then fills it.
  it.each(SEQUENCES)(
    'AC 11: %s/%s — after the first move and every Black reply (incl. pass), White captures within 5 plies',
    (l, id) => {
      const e = seq(l, id);
      const target = (e.goal as { target: Vertex }).target;
      const first = after(startState(e, e.toPlay), e.toPlay, e.line[0].at);
      const results = replies(first).map((r) => ({
        reply: r.at,
        killed: canForceCapture(r.state, target, 5),
      }));
      expect(results.filter((r) => !r.killed)).toEqual([]);
      // The scripted reply loses at once (the next White move captures).
      const scripted = after(first, e.line[1].color, e.line[1].at);
      expect(canForceCapture(scripted, target, 1)).toBe(true);
    },
  );

  // §12b: the spec said "within 6 plies"; the kill takes 7 from the start (W, pass, W, B, W, B, W).
  it.each(SEQUENCES)(
    'AC 12: %s/%s — at ply 0 only the line move inside the eye space kills (within 7 plies)',
    (l, id, space) => {
      const e = seq(l, id);
      const target = (e.goal as { target: Vertex }).target;
      const start = startState(e, e.toPlay);
      expect(canForceCapture(start, target, 7)).toBe(true);
      const kills = space.filter((at) => {
        const first = playAs(start, e.toPlay, at);
        if (!first.ok) return false;
        return replies(first.state).every((r) => canForceCapture(r.state, target, 5));
      });
      expect(kills).toEqual([e.line[0].at]);
    },
  );
});

describe('B. one-move claims proved by the engine (AC 13, §10)', () => {
  const S_TARGET = 'a2';

  it('u10 e1 find-eye: c1 is enclosed by Black and illegal for White', () => {
    const e = ex('u10-eyes', 'find-eye');
    const w = startAs(e, 'W');
    expect(checkMove(w, 'c1')).toEqual({ legal: false, reason: 'suicide' });
    for (const at of ['a1', 'a2', 'e1']) expect(checkMove(w, at).legal).toBe(true);
    expect(libertyCount(w, 'c3')).toBe(3);
  });

  it('u10 e2 real-corner: White a1 is illegal; the diagonal b2 is Black', () => {
    const w = startAs(ex('u10-eyes', 'real-corner'), 'W');
    expect(checkMove(w, 'a1')).toEqual({ legal: false, reason: 'suicide' });
  });

  it('u10 e3 false-edge: b1 has one liberty; White c1 is legal and captures it', () => {
    const w = startAs(ex('u10-eyes', 'false-edge'), 'W');
    expect(libertyCount(w, 'b1')).toBe(1);
    expect(libertyCount(w, 'c2')).toBeGreaterThanOrEqual(4);
    const result = play(w, 'c1');
    expect(result.ok && result.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['b1']);
  });

  it('u10 e4 which-real: A (a1) is illegal for White; B (e1) captures d1', () => {
    const w = startAs(ex('u10-eyes', 'which-real'), 'W');
    expect(checkMove(w, 'a1')).toEqual({ legal: false, reason: 'suicide' });
    expect(libertyCount(w, 'd1')).toBe(1);
    const result = play(w, 'e1');
    expect(result.ok && result.facts.captured.flat().map((p) => toVertex(p, 7))).toEqual(['d1']);
  });

  it('u10 e5 weak-stone: only d1 can be captured (one liberty, c1)', () => {
    const w = startAs(ex('u10-eyes', 'weak-stone'), 'W');
    expect(libertyCount(w, 'd1')).toBe(1);
    expect(libertyCount(w, 'b1')).toBe(5);
    const result = play(w, 'c1');
    expect(result.ok && result.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['d1']);
  });

  it('u10 e6 capture-cutter: b3 is the only capture; White cannot re-enter b2', () => {
    const e = ex('u10-eyes', 'capture-cutter');
    const b = startAs(e, 'B');
    expect(playMoveSolutions(b, { kind: 'capture' })).toEqual(['b3']);
    const afterCapture = after(b, 'B', 'b3');
    expect(checkMove(afterCapture, 'b2')).toEqual({ legal: false, reason: 'suicide' });
  });

  it('u10 steps: s2 White c1 captures b1', () => {
    const s2 = byId('u10-eyes').explain![1];
    const result = play(startState(s2.board!, 'W'), 'c1');
    expect(result.ok && result.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['b1']);
  });

  it('u11 two-eyes e1 count-eyes / r-count: two eyes, alive (6 plies)', () => {
    const w = startAs(ex('u11-two-eyes', 'count-eyes'), 'W');
    expect(checkMove(w, 'a1').legal).toBe(false);
    expect(checkMove(w, 'c1').legal).toBe(false);
    expect(lives(w, S_TARGET)).toBe(true);
    const r = startAs(ex('u11-review', 'r-count'), 'W');
    expect(checkMove(r, 'a5').legal).toBe(false);
    expect(checkMove(r, 'c5').legal).toBe(false);
    expect(lives(r, 'a4')).toBe(true);
  });

  it('u11 two-eyes e2 one-eye: White captures (c1 then a1)', () => {
    const w = startAs(ex('u11-two-eyes', 'one-eye'), 'W');
    expect(canForceCapture(w, 'a2', 3)).toBe(true);
    const c1 = after(w, 'W', 'c1');
    expect(checkMove(c1, 'a1')).toEqual({ legal: false, reason: 'suicide' });
  });

  it('u11 two-eyes e3 make-two / vital v1 live-straight: b1 lives, a1 and c1 die', () => {
    for (const e of [ex('u11-two-eyes', 'make-two'), ex('u11-vital', 'live-straight')]) {
      const b = startAs(e, 'B');
      expect(lives(after(b, 'B', 'b1'), S_TARGET)).toBe(true);
      for (const at of ['a1', 'c1']) {
        expect({ at, lives: lives(after(b, 'B', at), S_TARGET) }).toEqual({ at, lives: false });
      }
    }
  });

  it('u11 two-eyes e4 cannot-play / r-cannot: a1 and c1 are illegal for White', () => {
    for (const e of [ex('u11-two-eyes', 'cannot-play'), ex('u11-review', 'r-cannot')]) {
      const w = startAs(e, 'W');
      expect(checkMove(w, 'a1')).toEqual({ legal: false, reason: 'suicide' });
      expect(checkMove(w, 'c1')).toEqual({ legal: false, reason: 'suicide' });
    }
  });

  it('u11 two-eyes e5 one-big-eye: one eye (b1–c1) — dead, White to play kills', () => {
    const w = startAs(ex('u11-two-eyes', 'one-big-eye'), 'W');
    expect(canForceCapture(w, S_TARGET, 5)).toBe(true);
  });

  it('u11 two-eyes e6 after-vital: every Black move (and a pass) still dies', () => {
    const b = startAs(ex('u11-two-eyes', 'after-vital'), 'B');
    const results = replies(b).map((r) => ({
      reply: r.at,
      killed: canForceCapture(r.state, S_TARGET, 5),
    }));
    expect(results.filter((r) => !r.killed)).toEqual([]);
  });

  it('u11 two-eyes s1: White c1, then a1 captures 3', () => {
    const s1 = byId('u11-two-eyes').explain![0];
    let state = startState(s1.board!, 'W');
    let captured = 0;
    for (const move of s1.moves ?? []) {
      const result = playAs(state, move.color, move.at);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      captured = result.facts.captured.flat().length;
      state = result.state;
    }
    expect(captured).toBe(3);
  });

  it('u11 vital v3 live-bent: a1 lives, b1 and a2 die', () => {
    const b = startAs(ex('u11-vital', 'live-bent'), 'B');
    expect(lives(after(b, 'B', 'a1'), 'a3')).toBe(true);
    for (const at of ['b1', 'a2']) {
      expect({ at, lives: lives(after(b, 'B', at), 'a3') }).toEqual({ at, lives: false });
    }
  });

  it('u11 vital v4 kill-bent-tap: only White a1 kills', () => {
    const w = startAs(ex('u11-vital', 'kill-bent-tap'), 'W');
    const kills = ['a1', 'b1', 'a2'].filter((at) => {
      const first = playAs(w, 'W', at);
      return first.ok && replies(first.state).every((r) => canForceCapture(r.state, 'a3', 5));
    });
    expect(kills).toEqual(['a1']);
  });

  it('u11 vital v6 straight-four: White cannot kill (8 plies)', () => {
    const w = startAs(ex('u11-vital', 'straight-four'), 'W');
    expect(lives(w, 'a2', 8)).toBe(true);
  });

  it('u11 vital s2 / s3: the step lines are legal; s2 captures 6', () => {
    const [, s2, s3] = byId('u11-vital').explain!;
    let state = startState(s2.board!, 'W');
    let captured = 0;
    for (const move of s2.moves ?? []) {
      const result = playAs(state, move.color, move.at);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      captured = result.facts.captured.flat().length;
      state = result.state;
    }
    expect(captured).toBe(6);
    expect(playAs(startState(s3.board!, 'B'), 'B', 'a1').ok).toBe(true);
  });

  it('review r1: e1 is the only empty point enclosed by Black', () => {
    const w = startAs(ex('u11-review', 'r-find-eye'), 'W');
    expect(checkMove(w, 'e1')).toEqual({ legal: false, reason: 'suicide' });
    expect(libertyCount(w, 'c2')).toBe(5);
  });

  it('review r2: c5 is a false eye (White c5 captures b5)', () => {
    const w = startAs(ex('u11-review', 'r-false'), 'W');
    expect(libertyCount(w, 'b5')).toBe(1);
    const result = play(w, 'c5');
    expect(result.ok && result.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['b5']);
  });

  it('review r4/r6: c3 has one liberty in r4; the atari points of r6 are c2 and c4', () => {
    expect(libertyCount(startAs(ex('u11-review', 'r-capture'), 'B'), 'c3')).toBe(1);
    const r6 = startAs(ex('u11-review', 'r-atari'), 'B');
    expect(libertyCount(r6, 'c3')).toBe(2);
    expect(playMoveSolutions(r6, { kind: 'atari' })).toEqual(['c2', 'c4']);
  });

  it('the choice answers match the proofs above', () => {
    const correct = (lessonId: string, id: string) =>
      (ex(lessonId, id) as ChoiceExercise).options.findIndex((o) => o.correct);
    expect(correct('u11-two-eyes', 'one-eye')).toBe(0); // "Yes, it can"
    expect(correct('u11-two-eyes', 'after-vital')).toBe(1); // "No"
    expect(correct('u11-vital', 'straight-four')).toBe(1); // "No, it lives"
  });
});
