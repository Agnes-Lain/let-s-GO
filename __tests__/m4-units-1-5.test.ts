// M4 content units 1–5: acceptance criteria of docs/specs/M4-content-units-1-5.md §4.
// (ACs 2, 5 and 6 are covered by src/lessons/content.test.ts and __tests__/qa/i18n-content.test.ts.)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { nodeAfter } from '@/exercises/nextNode';
import {
  PLANNED_UNITS,
  computeStars,
  getSolution,
  getUnits,
  isCheckpointUnlocked,
  isUnlocked,
  loadLesson,
  mapRows,
  nextNode,
  type Exercise,
  type Lesson,
  type StarsByLesson,
} from '@/lessons';
import { LESSON_FILES, LESSON_TEXTS } from '@/lessons/registry';

type Outcome = Parameters<typeof computeStars>[0][number];

const lessons = LESSON_FILES as readonly Lesson[];
const byId = (id: string) => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
};
const M4 = [
  'u01-board',
  'u02-liberties',
  'u03-connection',
  'u04-capture',
  'u05-atari',
  'u05-review',
] as const;
/** Added by M4 item 2 (docs/specs/M4-bot-capture-go.md). */
const UNIT_6 = ['u06-capture-go', 'u06-checkpoint'] as const;

const stars = (entries: Record<string, number>): StarsByLesson =>
  Object.fromEntries(
    Object.entries(entries).map(([id, n]) => [id, { stars: n }]),
  ) as unknown as StarsByLesson;

describe('A. files (AC 1, 3)', () => {
  it('AC 1: content has the sample plus the six M4 files (and Unit 6 since M4 item 2), all registered', () => {
    const all = [...M4, ...UNIT_6];
    const files = readdirSync(join(__dirname, '../src/lessons/content')).sort();
    expect(files).toEqual(['u00-sample.json', ...all.map((id) => `${id}.json`)].sort());
    expect(lessons.map((l) => l.id).sort()).toEqual(['u00-sample', ...all].sort());
  });

  const counts: [string, number, string[]][] = [
    [
      'u01-board',
      3,
      [
        'tap-marked',
        'tap-named',
        'play-black',
        'whose-turn',
        'play-white',
        'stones-stay',
        'tap-whites',
      ],
    ],
    [
      'u02-liberties',
      4,
      [
        'tap-center',
        'count-edge',
        'tap-corner',
        'count-enemy',
        'fewest',
        'last-liberty',
        'take-liberty',
        'count-diagonal',
      ],
    ],
    [
      'u03-connection',
      3,
      [
        'one-or-two-a',
        'one-or-two-b',
        'which-pair',
        'count-group',
        'connect-gap',
        'connect-diagonal',
        'tap-group',
      ],
    ],
    [
      'u04-capture',
      4,
      [
        'capture-one',
        'capture-edge',
        'capture-corner',
        'capture-or-not',
        'capture-group',
        'tap-capture',
        'find-capture',
        'count-captured',
      ],
    ],
    [
      'u05-atari',
      4,
      [
        'make-atari',
        'which-atari',
        'last-liberty-b',
        'escape-extend',
        'escape-edge',
        'escape-trap',
        'atari-group',
        'rescue-capture',
      ],
    ],
    [
      'u05-review',
      0,
      [
        'r-liberties',
        'r-groups',
        'r-connect',
        'r-capture-group',
        'r-atari',
        'r-escape',
        'r-tap-group-libs',
        'r-which-capture',
      ],
    ],
  ];
  it.each(counts)('AC 3: %s has %i steps and the spec exercise ids', (id, steps, ids) => {
    const lesson = byId(id);
    expect(lesson.explain?.length ?? 0).toBe(steps);
    expect(lesson.exercises.map((e) => e.id)).toEqual(ids);
    expect(lesson.kind).toBe(id === 'u05-review' ? 'checkpoint' : 'lesson');
  });
});

describe('AC 4: engine solutions match the spec tables (§7)', () => {
  // [lesson, exercise #, expected]: points (sets), choice index, or count value.
  const rows: [string, number, string[] | number | { index: number }][] = [
    ['u01-board', 1, ['d2']],
    ['u01-board', 2, ['c4']],
    ['u01-board', 3, ['d2']],
    ['u01-board', 4, { index: 0 }],
    ['u01-board', 5, ['b3']],
    ['u01-board', 6, { index: 0 }],
    ['u01-board', 7, ['d4', 'b2', 'f6']],
    ['u02-liberties', 1, ['c3', 'd2', 'd4', 'e3']],
    ['u02-liberties', 2, 3],
    ['u02-liberties', 3, ['a2', 'b1']],
    ['u02-liberties', 4, 2],
    ['u02-liberties', 5, { index: 2 }],
    ['u02-liberties', 6, ['c2']],
    ['u02-liberties', 7, ['c2', 'b3', 'd3']],
    ['u02-liberties', 8, 4],
    ['u03-connection', 1, { index: 0 }],
    ['u03-connection', 2, { index: 1 }],
    ['u03-connection', 3, { index: 2 }],
    ['u03-connection', 4, 5],
    ['u03-connection', 5, ['c3']],
    ['u03-connection', 6, ['b3']],
    ['u03-connection', 7, ['c3', 'c2', 'd2']],
    ['u04-capture', 1, ['a3']],
    ['u04-capture', 2, ['c2']],
    ['u04-capture', 3, ['a2']],
    ['u04-capture', 4, { index: 1 }],
    ['u04-capture', 5, ['c3']],
    ['u04-capture', 6, ['c3']],
    ['u04-capture', 7, ['d5']],
    ['u04-capture', 8, 3],
    ['u05-atari', 1, ['c4', 'd3']],
    ['u05-atari', 2, { index: 1 }],
    ['u05-atari', 3, ['d2']],
    ['u05-atari', 4, ['c2']],
    ['u05-atari', 5, ['a4']],
    ['u05-atari', 6, { index: 1 }],
    ['u05-atari', 7, ['a1', 'c2']],
    ['u05-atari', 8, ['e3']],
    ['u05-review', 1, 2],
    ['u05-review', 2, 3],
    ['u05-review', 3, ['d3']],
    ['u05-review', 4, ['e5']],
    ['u05-review', 5, ['c5', 'd3']],
    ['u05-review', 6, ['e4']],
    ['u05-review', 7, ['b3', 'c2', 'c4', 'd2', 'e3']],
    ['u05-review', 8, { index: 0 }],
  ];

  it('covers all 46 exercises', () => {
    expect(rows).toHaveLength(46);
    expect(M4.reduce((n, id) => n + byId(id).exercises.length, 0)).toBe(46);
  });

  it.each(rows)('%s #%i', (id, n, expected) => {
    const solution = getSolution(byId(id).exercises[n - 1]) as {
      points?: string[];
      index?: number;
      value?: number;
    };
    if (Array.isArray(expected))
      expect([...(solution.points ?? [])].sort()).toEqual([...expected].sort());
    else if (typeof expected === 'number') expect(solution.value).toBe(expected);
    else expect(solution.index).toBe(expected.index);
  });
});

describe('B. text rules (AC 7–9)', () => {
  const keysOf = (lesson: Lesson): string[] => {
    const keys: string[] = [];
    JSON.stringify(lesson, (name, value) => {
      if (/Key$/.test(name) && typeof value === 'string') keys.push(value);
      return value;
    });
    return keys;
  };
  const toneMarked = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

  it.each(M4)('AC 7: %s zh-CN texts contain no pinyin', (id) => {
    for (const key of keysOf(byId(id))) {
      expect({ key, pinyin: toneMarked.test(LESSON_TEXTS['zh-CN'][key] ?? '') }).toEqual({
        key,
        pinyin: false,
      });
    }
  });

  const firstUse: [string, string, string][] = [
    ['lesson.u01-board.s1', '棋盘', 'qípán'],
    ['lesson.u01-board.s1', '交叉点', 'jiāochādiǎn'],
    ['lesson.u01-board.s2', '黑', 'hēi'],
    ['lesson.u01-board.s2', '白', 'bái'],
    ['lesson.u01-board.s3', '棋子', 'qízǐ'],
    ['lesson.u02-liberties.s1', '气', 'qì'],
    ['lesson.u03-connection.s1', '连接', 'liánjiē'],
    ['lesson.u03-connection.s1', '一块棋', 'yíkuàiqí'],
    ['lesson.u04-capture.s2', '提子', 'tízǐ'],
    ['lesson.u05-atari.s1', '叫吃', 'jiàochī'],
    ['lesson.u05-atari.s2', '长', 'zhǎng'],
  ];
  it.each(firstUse)('AC 7: %s introduces %s %s in en and fr', (key, hanzi, pinyin) => {
    for (const lang of ['en', 'fr'] as const) {
      expect(LESSON_TEXTS[lang][key]).toContain(`${hanzi} ${pinyin}`);
    }
  });

  it('AC 8: only u01-board shows coordinates', () => {
    for (const id of M4) {
      expect(Boolean((byId(id) as { coordinates?: boolean }).coordinates)).toBe(id === 'u01-board');
    }
  });

  it.each(M4)('AC 9: %s — hints and explanations', (id) => {
    for (const exercise of byId(id).exercises as (Exercise & {
      hintKey?: string;
      explainKey?: string;
      hintPoints?: string[];
      options?: { correct?: boolean; whyKey?: string }[];
    })[]) {
      const label = `${id}/${exercise.id}`;
      if (exercise.type !== 'choice')
        expect({ label, hint: !!exercise.hintKey }).toEqual({ label, hint: true });
      expect({ label, help: !!(exercise.hintKey || exercise.explainKey) }).toEqual({
        label,
        help: true,
      });
      if (exercise.type === 'choice' && !exercise.hintKey) {
        for (const option of exercise.options ?? []) {
          if (!option.correct)
            expect({ label, why: !!option.whyKey }).toEqual({ label, why: true });
        }
      }
      if (exercise.hintPoints && exercise.type !== 'choice' && exercise.type !== 'count') {
        const solution = getSolution(exercise).points;
        for (const p of exercise.hintPoints)
          expect({ label, p, inSolution: solution.includes(p) }).toEqual({
            label,
            p,
            inSolution: true,
          });
      }
    }
  });
});

describe('C. stars and unlocks (AC 10, 11)', () => {
  const units = getUnits({ includeDev: false });

  it('AC 10: 3★ on each lesson unlocks the next unit; u05-atari opens the review', () => {
    const order = ['u01-board', 'u02-liberties', 'u03-connection', 'u04-capture', 'u05-atari'];
    const progress: Record<string, number> = {};
    for (let i = 0; i < order.length; i++) {
      const lesson = byId(order[i]);
      expect(isUnlocked(units, stars(progress), i + 1)).toBe(true);
      if (i + 2 <= 5) expect(isUnlocked(units, stars(progress), i + 2)).toBe(false);
      progress[lesson.id] = computeStars(lesson.exercises.map((): Outcome => 'clean'));
      expect(progress[lesson.id]).toBe(3);
      if (i + 2 <= 5) expect(isUnlocked(units, stars(progress), i + 2)).toBe(true);
    }
    expect(isCheckpointUnlocked(units, stars(progress), 5)).toBe(true);
    // M4 item 2 (AC 59): Unit 6 now has content and opens after 1★ on Unit 5.
    expect(isUnlocked(units, stars(progress), 6)).toBe(true);
  });

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
  ] as [[Outcome, number][], number][])('AC 11: %j → %i★', (spec, expected) => {
    expect(computeStars(run(spec))).toBe(expected);
  });
});

describe('D. unit map (AC 13–18)', () => {
  const units = getUnits({ includeDev: false });
  const state = (progress: Record<string, number>) =>
    mapRows(units, stars(progress)).map((r) => `${r.key}:${r.state}`);

  // Updated by M4 item 2 (AC 58): Unit 6 has a lesson and a checkpoint, nothing is planned.
  it('AC 13: units 1–6 have lessons, units 5 and 6 a checkpoint, nothing after', () => {
    expect(PLANNED_UNITS).toEqual([]);
    expect(units.map((u) => [u.unit, !!u.lesson, !!u.checkpoint])).toEqual([
      [1, true, false],
      [2, true, false],
      [3, true, false],
      [4, true, false],
      [5, true, true],
      [6, true, true],
    ]);
  });

  it('AC 14: fresh install — Unit 1 available, the rest locked (Unit 6 too since M4 item 2); Continue → u01-board', () => {
    expect(state({})).toEqual([
      'unit-1:available',
      'unit-2:locked',
      'unit-3:locked',
      'unit-4:locked',
      'unit-5:locked',
      'checkpoint-5:locked',
      'unit-6:locked',
      'checkpoint-6:locked',
    ]);
    expect(nextNode(units, stars({}))?.lesson.id).toBe('u01-board');
  });

  it('AC 15: 1★ opens the next unit, 0★ does not; the checkpoint gates nothing', () => {
    expect(state({ 'u01-board': 1 })[1]).toBe('unit-2:available');
    expect(state({ 'u01-board': 0 })[1]).toBe('unit-2:locked');
    const allOne = {
      'u01-board': 1,
      'u02-liberties': 1,
      'u03-connection': 1,
      'u04-capture': 1,
      'u05-atari': 1,
    };
    expect(state(allOne).slice(4)).toEqual([
      'unit-5:done',
      'checkpoint-5:available',
      'unit-6:available',
      'checkpoint-6:locked',
    ]);
  });

  it('AC 16: production hides the sample; dev shows it first without gating Unit 1', () => {
    expect(units.some((u) => u.unit === 0)).toBe(false);
    expect(loadLesson('u00-sample', { includeDev: false }).ok).toBe(false);
    const dev = getUnits({ includeDev: true });
    expect(dev[0].lesson?.id).toBe('u00-sample');
    expect(isUnlocked(dev, stars({}), 1)).toBe(true);
  });

  it('AC 17: everything with ≥ 1★ → nothing left to continue', () => {
    const units1to5 = Object.fromEntries(M4.map((id) => [id, 1]));
    expect(nextNode(units, stars(units1to5))?.lesson.id).toBe('u06-capture-go'); // M4 item 2
    const all = Object.fromEntries([...M4, ...UNIT_6].map((id) => [id, 1]));
    expect(nextNode(units, stars(all))).toBeNull();
  });

  // The u05-review part is superseded by M4 item 2 AC 61: Next leads to Unit 6.
  it('AC 18: after u05-atari → Next is u05-review; after u05-review → u06-capture-go', () => {
    const progress = stars({
      'u01-board': 1,
      'u02-liberties': 1,
      'u03-connection': 1,
      'u04-capture': 1,
      'u05-atari': 1,
    });
    expect(nodeAfter(units, progress, 'u05-atari')?.lesson.id).toBe('u05-review');
    expect(
      nodeAfter(units, stars({ ...Object.fromEntries(M4.map((id) => [id, 1])) }), 'u05-review')
        ?.lesson.id,
    ).toBe('u06-capture-go');
  });
});
