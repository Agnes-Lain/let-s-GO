// M5 item 4 — territory, counting and end of game (spec docs/specs/M5-territory-counting.md):
// content (AC 1–8), engine proofs (AC 9–15, §7.0, §10). Boards are ASCII: X black, O white.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { forcedCapture } from '@/bot';
import {
  createGame,
  parseBoard,
  pass,
  play,
  score,
  type Board,
  type Color,
  type GameState,
  type Vertex,
} from '@/engine';
import {
  PLANNED_UNITS,
  getSolution,
  getUnits,
  mapRows,
  scoreFacts,
  validateCatalog,
  validateLesson,
  type ChoiceExercise,
  type Exercise,
  type Lesson,
  type MarkExercise,
} from '@/lessons';
import { canForceCapture } from '@/lessons/__fixtures__/lifeDeath';
import { hasTextIn } from '@/lessons/loader';
import { LESSON_FILES, LESSON_TEXTS } from '@/lessons/registry';

const lessons = LESSON_FILES as readonly Lesson[];
const IDS = ['u12-territory', 'u13-counting', 'u14-end', 'u14-review'] as const;
const byId = (id: string): Lesson => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
};
const ex = (lesson: string, id: string): Exercise => {
  const found = byId(lesson).exercises.find((e) => e.id === id);
  if (!found) throw new Error(`missing exercise ${lesson}/${id}`);
  return found;
};

/** The position library of §7.0, as ASCII boards. */
const POSITIONS: Record<string, string> = {
  T1: `
    5 . . X O .
    4 . . X O .
    3 . . X O .
    2 . . X O .
    1 . . X O .`,
  A: `
    5 . X O . .
    4 . X O . .
    3 . X O . .
    2 . X O . .
    1 . X O . .`,
  C: `
    5 . . . . .
    4 O O O O .
    3 X X X O O
    2 . . X X X
    1 . . . . .`,
  C2: `
    5 . . . . .
    4 O O O . .
    3 X X O O O
    2 . X X X X
    1 . . . . .`,
  P3: `
    5 . X . O .
    4 . X . O .
    3 . X . O .
    2 . X . O .
    1 . X . O .`,
  D: `
    5 . . . . .
    4 O O O O O
    3 X X X . .
    2 . . X X X
    1 . . . . .`,
  R1: `
    7 . . . . . . .
    6 O O O O . . .
    5 X X X O O . .
    4 . . X X O . .
    3 . . . X O . .
    2 . . . X O . .
    1 . . . X O . .`,
  R3: `
    7 . . . . . . .
    6 . . . . . . .
    5 O O O O O . .
    4 X X X X O O O
    3 . . . X X X X
    2 . . . . . . .
    1 . . . . . . .`,
  R4: `
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 . . . . . . . . .
    6 O O O O O O O O O
    5 X X X X X X X X X
    4 . . . . . . . . .
    3 . . . . . . . . .
    2 . . . . . . . . .
    1 . . . . . . . . .`,
  K0: `
    5 . . . . .
    4 . . . . .
    3 O O O O O
    2 X X X X X
    1 . . . . .`,
  K: `
    5 . . . . .
    4 . . . . .
    3 O O O O O
    2 X X X X X
    1 . . O . .`,
  K2: `
    5 . . X . .
    4 O O O O O
    3 X X X X X
    2 . . . . .
    1 . . . . .`,
  N: `
    5 . . X . .
    4 . . . . .
    3 O O O O O
    2 X X X X X
    1 . . O . .`,
};
const board = (name: string): Board => parseBoard(POSITIONS[name]).board;
const DEAD: Record<string, Vertex[]> = { K: ['c1'], K2: ['c5'], N: ['c1', 'c5'] };
const gameOf = (name: string, toPlay: Color): GameState => {
  const b = board(name);
  const stones = (c: Color) =>
    b.cells.flatMap((cell, i) =>
      cell === c ? [`${'abcdefghj'[i % b.size]}${Math.floor(i / b.size) + 1}`] : [],
    );
  return createGame(b.size, { setup: { B: stones('B'), W: stones('W') }, toPlay });
};

describe('A. files and validity (AC 1–8)', () => {
  it('AC 1: the four files exist, are registered and are hand-written', () => {
    const files = readdirSync(join(__dirname, '../src/lessons/content'));
    for (const id of IDS) {
      expect(files).toContain(`${id}.json`);
      expect(byId(id).generatedFrom).toBeUndefined();
    }
  });

  it.each(IDS)('AC 2: %s validates with the real texts', (id) => {
    const result = validateLesson(byId(id), { hasText: hasTextIn(LESSON_TEXTS) });
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('AC 2: the catalog is consistent; Units 1–14 have a lesson, nothing is planned', () => {
    expect(validateCatalog([...lessons])).toEqual({ ok: true });
    expect(PLANNED_UNITS).toEqual([]);
    const units = getUnits();
    expect(units.map((u) => u.unit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(units.every((u) => u.lesson !== null)).toBe(true);
    expect(units.find((u) => u.unit === 14)?.checkpoint?.id).toBe('u14-review');
    expect(mapRows(units, {}).some((r) => r.state === 'soon')).toBe(false);
  });

  it('AC 3: steps 3/3/3/0, exercises 7/7/7/7 with the ids and types of §7', () => {
    expect(IDS.map((id) => byId(id).explain?.length ?? 0)).toEqual([3, 3, 3, 0]);
    expect(IDS.map((id) => byId(id).exercises.map((e) => `${e.id}:${e.type}`))).toEqual([
      [
        'mark-b-edge:mark',
        'mark-b-corner:mark',
        'mark-w-corner:mark',
        'who-owns:choice',
        'mark-b-dame:mark',
        'mark-b-contact:mark',
        'count-terr:count',
      ],
      [
        'stones-b:count',
        'terr-b:count',
        'area-b:count',
        'area-w:count',
        'komi-tie:choice',
        'area-b-7:count',
        'winner-7:choice',
      ],
      [
        'two-passes:choice',
        'one-pass:choice',
        'dead-1:mark',
        'dead-2:mark',
        'dead-both:mark',
        'area-dead-b:count',
        'area-dead-w:count',
      ],
      [
        'r-terr-w:mark',
        'r-owner:choice',
        'r-area-w:count',
        'r-area-9:count',
        'r-winner-9:choice',
        'r-dead:mark',
        'r-winner-n:choice',
      ],
    ]);
    expect(byId('u14-review').kind).toBe('checkpoint');
    expect(byId('u14-review').unit).toBe(14);
  });

  const RIGHT: [string, string, unknown][] = [
    ['u12-territory', 'mark-b-edge', ['a1', 'a2', 'a3', 'a4', 'a5']],
    ['u12-territory', 'mark-b-corner', ['a1', 'a2', 'b1', 'b2', 'c1', 'd1', 'e1']],
    ['u12-territory', 'mark-w-corner', ['a5', 'b5', 'c5', 'd4', 'd5', 'e4', 'e5']],
    ['u12-territory', 'who-owns', 'none'],
    ['u12-territory', 'mark-b-dame', ['a1', 'a2', 'a3', 'a4', 'a5']],
    ['u12-territory', 'mark-b-contact', ['a1', 'a2', 'b1', 'b2', 'c1', 'd1', 'e1']],
    ['u12-territory', 'count-terr', 11],
    ['u13-counting', 'stones-b', 6],
    ['u13-counting', 'terr-b', 7],
    ['u13-counting', 'area-b', 13],
    ['u13-counting', 'area-w', 12],
    ['u13-counting', 'komi-tie', 'W'],
    ['u13-counting', 'area-b-7', 25],
    ['u13-counting', 'winner-7', 'B'],
    ['u14-end', 'dead-1', ['c1']],
    ['u14-end', 'dead-2', ['c5']],
    ['u14-end', 'dead-both', ['c1', 'c5']],
    ['u14-end', 'area-dead-b', 10],
    ['u14-end', 'area-dead-w', 15],
    ['u14-review', 'r-terr-w', ['a5', 'b5', 'c5', 'd5', 'e5']],
    ['u14-review', 'r-owner', 'none'],
    ['u14-review', 'r-area-w', 10],
    ['u14-review', 'r-area-9', 45],
    ['u14-review', 'r-winner-9', 'B'],
    ['u14-review', 'r-dead', ['c1', 'c5']],
    ['u14-review', 'r-winner-n', 'W'],
  ];
  it.each(RIGHT)('AC 4: %s/%s → %j', (lesson, id, right) => {
    const e = ex(lesson, id);
    const solution = getSolution(e);
    if ('points' in solution) expect([...solution.points].sort()).toEqual(right);
    else if ('value' in solution) expect(solution.value).toBe(right);
    else expect((e as ChoiceExercise).options[solution.index].outcome).toBe(right);
  });

  it('AC 4: u14-end e1/e2 — the right options are "the game ends" and "no, two passes"', () => {
    expect(getSolution(ex('u14-end', 'two-passes') as ChoiceExercise).index).toBe(0);
    expect(getSolution(ex('u14-end', 'one-pass') as ChoiceExercise).index).toBe(0);
  });

  it('AC 6: wrong options have a whyKey; marks have hint, hintPoints and explain; coordinates on', () => {
    for (const id of IDS) {
      const lesson = byId(id);
      expect(lesson.coordinates).toBe(true);
      for (const e of lesson.exercises) {
        if (e.type === 'choice') {
          for (const o of e.options) if (!o.correct) expect(o.whyKey).toBeDefined();
        }
        if (e.type === 'mark') {
          expect(e.hintKey).toBeDefined();
          expect(e.explainKey).toBeDefined();
          const solution = getSolution(e).points;
          expect(e.hintPoints?.length).toBeGreaterThan(0);
          for (const p of e.hintPoints ?? []) expect(solution).toContain(p);
        }
      }
    }
  });

  it('AC 6: a dead-stone mark whose position has an alive group has whyKeys for it', () => {
    // Only N has two alive groups that a learner may tap (§7.3); K / K2 use the generic line.
    for (const [lesson, id] of [
      ['u14-end', 'dead-both'],
      ['u14-review', 'r-dead'],
    ]) {
      const e = ex(lesson, id) as MarkExercise;
      expect(Object.keys(e.whyKeys ?? {}).sort()).toEqual(['a2', 'a3']);
    }
  });

  it('AC 8: Units 2, 5, 10 and 11 keep plain or liberties counts (chips)', () => {
    const counts = lessons
      .filter((l) => ['u02', 'u05', 'u10', 'u11'].includes(l.id.slice(0, 3)))
      .flatMap((l) => l.exercises)
      .filter((e) => e.type === 'count');
    expect(counts.length).toBeGreaterThan(0);
    for (const e of counts) {
      if (e.type !== 'count') continue;
      expect(typeof e.answer === 'number' || 'libertiesOf' in e.answer).toBe(true);
    }
  });
});

describe('A. texts (AC 5, §8)', () => {
  const keysOf = (lesson: Lesson): string[] => {
    const keys: string[] = [];
    JSON.stringify(lesson, (name, value) => {
      if (/Key$/.test(name) && typeof value === 'string') keys.push(value);
      if (name === 'whyKeys') keys.push(...(Object.values(value) as string[]));
      return value;
    });
    return keys;
  };
  const stepKeys = new Set(IDS.flatMap((id) => (byId(id).explain ?? []).map((s) => s.textKey)));
  const GLOBAL = [
    'unit.12.title',
    'unit.13.title',
    'unit.14.title',
    'practice.mark.count',
    'practice.mark.clear',
    'practice.mark.a11y.territory.B',
    'practice.mark.a11y.territory.W',
    'practice.mark.a11y.dead',
    'practice.mark.a11y.removed',
    'fb.mark.extra.stone',
    'fb.mark.empty',
    'fb.mark.extra.dame',
    'fb.mark.extra.other',
    'fb.mark.extra.alive',
    'fb.mark.missing_one',
    'fb.mark.missing_other',
    'practice.count.backspace',
    'practice.count.entry.a11y',
    'practice.count.entry.empty',
    'practice.count.scratch.a11y',
    'fb.count.score.wrong',
    'fb.count.score.stonesOnly',
    'fb.count.score.territoryOnly',
    'fb.count.score.withDame',
    'fb.count.score.otherSide',
    'fb.count.score.deadKept',
    'fb.count.score.reveal',
  ];
  const keys = [...new Set([...IDS.flatMap((id) => keysOf(byId(id))), ...GLOBAL])];

  it.each(keys)('%s exists in zh-CN, en and fr within the limits', (key) => {
    for (const lang of ['zh-CN', 'en', 'fr'] as const) {
      const text = LESSON_TEXTS[lang][key];
      expect({ key, lang, defined: typeof text === 'string' }).toEqual({
        key,
        lang,
        defined: true,
      });
      const limit = lang === 'zh-CN' ? 70 : stepKeys.has(key) ? 135 : 160;
      expect({ key, lang, ok: [...text].length <= limit }).toEqual({ key, lang, ok: true });
    }
  });

  it('zh-CN has no pinyin in any new text', () => {
    for (const key of keys) {
      const text = LESSON_TEXTS['zh-CN'][key].replace(/\{\{\w+\}\}/g, '');
      expect({ key, pinyin: /[a-zà-ǜ]{2,}/i.test(text) }).toEqual({ key, pinyin: false });
    }
  });

  it.each([
    ['地 dì', 'lesson.u12-territory.s1'],
    ['单官 dānguān', 'lesson.u12-territory.s3'],
    ['数子 shùzǐ', 'lesson.u13-counting.s1'],
    ['贴目 tiēmù', 'lesson.u13-counting.s3'],
    ['弃权 qìquán', 'lesson.u14-end.s1'],
    ['终局 zhōngjú', 'lesson.u14-end.s1'],
    ['死子 sǐzǐ', 'lesson.u14-end.s2'],
    ['数子 shùzǐ', 'unit.13.title'],
    ['终局 zhōngjú', 'unit.14.title'],
  ])('§8: en and fr give "%s" in %s', (term, key) => {
    expect(LESSON_TEXTS.en[key]).toContain(term);
    expect(LESSON_TEXTS.fr[key]).toContain(term);
  });
});

describe('B. engine re-proof of §7.0 (AC 9–12, 15)', () => {
  // [position, B stones / territory / area, W stones / territory / area, dame count]
  const TABLE: [string, number[], number[], number][] = [
    ['T1', [5, 10, 15], [5, 5, 10], 0],
    ['A', [5, 5, 10], [5, 10, 15], 0],
    ['C', [6, 7, 13], [6, 6, 12], 0],
    ['C2', [6, 6, 12], [6, 7, 13], 0],
    ['P3', [5, 5, 10], [5, 5, 10], 5],
    ['D', [6, 7, 13], [5, 5, 10], 2],
    ['R1', [8, 11, 19], [10, 20, 30], 0],
    ['R3', [8, 17, 25], [8, 16, 24], 0],
    ['R4', [9, 36, 45], [9, 27, 36], 0],
    ['K', [5, 5, 10], [5, 10, 15], 0],
    ['N', [5, 5, 10], [5, 10, 15], 0],
  ];
  it.each(TABLE)('%s: B %j, W %j, %i neutral points', (name, b, w, dame) => {
    const facts = scoreFacts(board(name), DEAD[name]);
    expect([facts.B.stones, facts.B.territory, facts.B.area]).toEqual(b);
    expect([facts.W.stones, facts.W.territory, facts.W.area]).toEqual(w);
    expect(facts.dame.length).toBe(dame);
    // Every point is counted once: areas + neutral points = the board (§10 b).
    expect(facts.B.area + facts.W.area + dame).toBe(board(name).size ** 2);
  });

  it('K with c1 kept: Black 5 / 0 / 5 (the row-1 regions touch both colours)', () => {
    const facts = scoreFacts(board('K'));
    expect([facts.B.stones, facts.B.territory, facts.B.area]).toEqual([5, 0, 5]);
  });

  it('AC 10: D neutral points are d3 and e3', () => {
    expect(scoreFacts(board('D')).dame).toEqual(['d3', 'e3']);
  });

  it.each([
    ['P3', 0.5, 'W+0.5'],
    ['D', 0.5, 'B+2.5'],
    ['R3', 0.5, 'B+0.5'],
    ['R4', 7.5, 'B+1.5'],
    ['N', 0.5, 'W+5.5'],
  ])('AC 11 / §10 d: %s with komi %d → %s', (name, komi, result) => {
    expect(score(board(name), { komi, deadStones: DEAD[name] }).result).toBe(result);
  });

  it('AC 12: every position starts legally with stones of both colours', () => {
    for (const name of Object.keys(POSITIONS)) {
      const game = gameOf(name, 'B');
      expect(new Set(game.board.cells.filter((c) => c !== null))).toEqual(new Set(['B', 'W']));
    }
    // And the lesson positions are the same boards (one sample per position).
    const same = (e: Exercise, name: string) =>
      expect(createGame(e.size, { setup: e.setup }).board.cells).toEqual(board(name).cells);
    same(ex('u12-territory', 'mark-b-edge'), 'A');
    same(ex('u12-territory', 'mark-b-corner'), 'C');
    same(ex('u12-territory', 'mark-w-corner'), 'C2');
    same(ex('u12-territory', 'who-owns'), 'P3');
    same(ex('u12-territory', 'mark-b-contact'), 'D');
    same(ex('u12-territory', 'count-terr'), 'R1');
    same(ex('u13-counting', 'area-b-7'), 'R3');
    same(ex('u14-review', 'r-area-9'), 'R4');
    same(ex('u14-end', 'two-passes'), 'K0');
    same(ex('u14-end', 'dead-1'), 'K');
    same(ex('u14-end', 'dead-2'), 'K2');
    same(ex('u14-end', 'dead-both'), 'N');
    const t1 = byId('u12-territory').explain?.[0].board;
    expect(createGame(5, { setup: t1?.setup }).board.cells).toEqual(board('T1').cells);
  });

  it('AC 15: the numbers in the step texts are the engine numbers', () => {
    const d = scoreFacts(board('D'));
    expect(`${d.B.stones}+${d.B.territory}=${d.B.area}`).toBe('6+7=13');
    expect(`${d.W.stones}+${d.W.territory}=${d.W.area}`).toBe('5+5=10');
    expect(d.W.area + 0.5).toBe(10.5);
    const k = scoreFacts(board('K'), ['c1']);
    expect(`${k.B.stones}+${k.B.territory}=${k.B.area}`).toBe('5+5=10');
    expect(`${k.W.stones}+${k.W.territory}=${k.W.area}`).toBe('5+10=15');
    for (const lang of ['zh-CN', 'en', 'fr'] as const) {
      expect(LESSON_TEXTS[lang]['lesson.u13-counting.s1']).toMatch(/6\D+7\D+13/);
      expect(LESSON_TEXTS[lang]['lesson.u13-counting.s2']).toMatch(/5\D+5\D+10/);
      expect(LESSON_TEXTS[lang]['lesson.u13-counting.s3']).toMatch(/10[.,]5/);
      expect(LESSON_TEXTS[lang]['lesson.u14-end.s3']).toMatch(/5\D+5\D+10\D+5\D+10\D+15/);
    }
  });
});

describe('B. dead and alive (AC 13, 14)', () => {
  it.each([
    ['K', 'c1', 'W'],
    ['K2', 'c5', 'B'],
    ['N', 'c1', 'W'],
    ['N', 'c5', 'B'],
  ] as const)(
    'AC 13a: %s — the walls capture %s (bounded search, defender runs)',
    (name, at, owner) => {
      const attacker = owner === 'B' ? 'W' : 'B';
      const result = forcedCapture(gameOf(name, attacker), { attacker, target: at, maxMoves: 8 });
      expect(result.forced).toBe(true);
    },
  );

  // The fewest plies to capture each wall are 7 (four liberties) and 9 (five liberties); the
  // exhaustive search gives the attacker two more plies than that and still finds no capture.
  it.each([
    ['K', 'a2', 'W', 9],
    ['N', 'a2', 'W', 9],
    ['K2', 'a4', 'B', 9],
    ['N', 'a3', 'B', 11],
  ] as const)(
    'AC 13b: %s — the wall at %s lives even when %s (owner of the dead stone) moves first (%i plies)',
    (name, wall, first, plies) => {
      expect(canForceCapture(gameOf(name, first), wall, plies)).toBe(false);
    },
  );

  // §12b (PO 2026-10-21): every territory position is alive — each wall survives 11 plies with the
  // other side moving first, so no group would have to be removed before counting.
  it.each([
    ['T1', 'c1', 'd1'],
    ['A', 'b1', 'c1'],
    ['C', 'a3', 'a4'],
    ['C2', 'a3', 'a4'],
    ['P3', 'b1', 'd1'],
    ['D', 'a3', 'a4'],
  ])('§10 f: %s — both walls (%s, %s) live within 11 plies', (name, black, white) => {
    expect(canForceCapture(gameOf(name, 'W'), black, 11)).toBe(false);
    expect(canForceCapture(gameOf(name, 'B'), white, 11)).toBe(false);
  });

  it('AC 14: Black pass + White pass ends the game; pass, move, pass does not', () => {
    const start = gameOf('K0', 'B');
    const one = pass(start);
    if (!one.ok) throw new Error('pass failed');
    const two = pass(one.state);
    expect(two.ok && two.state.isOver).toBe(true);
    const move = play(one.state, 'c5');
    if (!move.ok) throw new Error('move failed');
    const again = pass(move.state);
    expect(again.ok && again.state.isOver).toBe(false);
  });
});
