// M4 item 2, Unit 6 Capture Go 吃子棋: content, map, stars and flow ACs of
// docs/specs/M4-bot-capture-go.md (34, 37–42, 58–61). Bot ACs live in src/bot, reducer ACs in
// src/exercises/botGame.test.ts, screen ACs in src/exercises/runners/PlayBotRunner.test.tsx.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createGame, groupAt, legalMoves, play, toVertex } from '@/engine';
import { nodeAfter } from '@/exercises/nextNode';
import {
  PLANNED_UNITS,
  computeStars,
  getUnits,
  hasTextIn,
  isCheckpointUnlocked,
  isUnlocked,
  mapRows,
  nextNode,
  validateCatalog,
  validateLesson,
  type Lesson,
  type Outcome,
  type PlayBotExercise,
  type StarsByLesson,
} from '@/lessons';
import { LESSON_FILES, LESSON_TEXTS } from '@/lessons/registry';

const lessons = LESSON_FILES as readonly Lesson[];
const byId = (id: string) => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
};
const lesson = byId('u06-capture-go');
const checkpoint = byId('u06-checkpoint');
const games = [...lesson.exercises, ...checkpoint.exercises] as PlayBotExercise[];

const stars = (entries: Record<string, number>): StarsByLesson =>
  Object.fromEntries(
    Object.entries(entries).map(([id, n]) => [id, { stars: n }]),
  ) as unknown as StarsByLesson;
const UNITS_1_5 = ['u01-board', 'u02-liberties', 'u03-connection', 'u04-capture', 'u05-atari'];

function textKeys(value: unknown): string[] {
  const keys: string[] = [];
  JSON.stringify(value, (name, v) => {
    if (/Key$/.test(name) && typeof v === 'string') keys.push(v);
    return v;
  });
  return keys;
}

describe('D. content (AC 34, 37–42)', () => {
  it('AC 37: both files exist and are registered', () => {
    const files = readdirSync(join(__dirname, '../src/lessons/content'));
    expect(files).toEqual(expect.arrayContaining(['u06-capture-go.json', 'u06-checkpoint.json']));
    expect(lessons.map((l) => l.id)).toEqual(
      expect.arrayContaining(['u06-capture-go', 'u06-checkpoint']),
    );
  });

  it('AC 38: 3 steps + 3 games and 0 steps + 2 games with the spec ids', () => {
    expect(lesson.kind).toBe('lesson');
    expect(lesson.explain).toHaveLength(3);
    expect(lesson.exercises.map((e) => [e.id, e.type])).toEqual([
      ['first-capture', 'play-bot'],
      ['crosscut-first', 'play-bot'],
      ['crosscut-two', 'play-bot'],
    ]);
    expect(checkpoint.kind).toBe('checkpoint');
    expect(checkpoint.explain ?? []).toHaveLength(0);
    expect(checkpoint.exercises.map((e) => e.id)).toEqual(['seven-two', 'seven-white']);
  });

  it('§3 game table: sizes, colours, first-to-n', () => {
    expect(games.map((g) => [g.size, g.player ?? 'B', g.first ?? 'B', g.win.n])).toEqual([
      [5, 'B', 'B', 1],
      [5, 'B', 'B', 1],
      [5, 'B', 'B', 2],
      [7, 'B', 'B', 2],
      [7, 'W', 'B', 3],
    ]);
    expect(games.every((g) => g.bot.level === 1 && g.bot.seed === undefined)).toBe(true);
  });

  it('AC 34: both validate with the real texts; the catalog has a Unit 6 lesson and checkpoint', () => {
    const hasText = hasTextIn(LESSON_TEXTS);
    for (const l of [lesson, checkpoint]) {
      const result = validateLesson(l, { hasText });
      expect(result.ok ? [] : result.errors).toEqual([]);
    }
    expect(validateCatalog(lessons.filter((l) => l.unit !== 0))).toEqual({ ok: true });
  });

  it('AC 39: every key exists in zh-CN, en and fr; zh-CN ≤ 70, en/fr ≤ 160, steps ≤ 135', () => {
    for (const l of [lesson, checkpoint]) {
      for (const key of textKeys(l)) {
        for (const lang of ['zh-CN', 'en', 'fr'] as const) {
          const text = LESSON_TEXTS[lang][key];
          expect({ key, lang, ok: typeof text === 'string' && text.length > 0 }).toEqual({
            key,
            lang,
            ok: true,
          });
          const limit = lang === 'zh-CN' ? 70 : /\.s\d$/.test(key) ? 135 : 160;
          expect({ key, lang, tooLong: [...text].length > limit }).toEqual({
            key,
            lang,
            tooLong: false,
          });
        }
      }
    }
  });

  it('AC 39: all game.* keys of §11 exist in the three languages', () => {
    const keys = [
      'game.you',
      'game.bot',
      'game.black',
      'game.white',
      'game.turn.you',
      'game.turn.bot',
      'game.fb.yourAtari',
      'game.fb.botAtari',
      'game.fb.captured',
      'game.fb.botCaptured',
      'game.fb.noMoves',
      'game.fb.botPass',
      'game.fb.illegal.suicide',
      'game.fb.illegal.ko',
      'game.fb.illegal.occupied',
      'game.hint.capture',
      'game.hint.save',
      'game.hint.atari',
      'game.win.title',
      'game.win.body',
      'game.lose.title',
      'game.lose.body',
      'game.lose.reason',
      'game.draw.title',
      'game.draw.body',
      'game.retry',
      'game.next',
      'game.finish',
      'game.skip',
      'game.restart',
      'game.a11y.botMoved',
      'game.a11y.captured',
      'game.a11y.score',
      'complete.gamesFirstTry',
    ];
    for (const key of keys) {
      for (const lang of ['zh-CN', 'en', 'fr'] as const) {
        expect({ key, lang, ok: Boolean(LESSON_TEXTS[lang][key]) }).toEqual({
          key,
          lang,
          ok: true,
        });
      }
    }
  });

  it('AC 40: no pinyin in zh-CN; en/fr s1 introduce 吃子棋 chīzǐqí; ko/suicide are not named', () => {
    const toneMarked = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
    for (const key of [...textKeys(lesson), ...textKeys(checkpoint)]) {
      expect({ key, pinyin: toneMarked.test(LESSON_TEXTS['zh-CN'][key]) }).toEqual({
        key,
        pinyin: false,
      });
      for (const lang of ['en', 'fr'] as const) {
        expect(LESSON_TEXTS[lang][key]).not.toMatch(/\bko\b|suicid|打劫|禁入点/i);
      }
    }
    for (const lang of ['en', 'fr'] as const) {
      expect(LESSON_TEXTS[lang]['lesson.u06-capture-go.s1']).toContain('吃子棋 chīzǐqí');
    }
  });

  it('AC 41: the hand-verified start positions hold in the engine', () => {
    for (const g of games) {
      const state = createGame(g.size, { setup: g.setup });
      for (const color of ['B', 'W'] as const) {
        for (const at of g.setup[color] ?? []) {
          expect(groupAt(state.board, at)?.liberties.length).toBeGreaterThan(0);
        }
      }
    }
    // G1: White c3 has exactly one liberty (c4); c4 is the only capturing move for Black.
    const g1 = createGame(5, { setup: games[0].setup });
    expect(groupAt(g1.board, 'c3')?.liberties.map((p) => toVertex(p, 5))).toEqual(['c4']);
    const capturing = legalMoves(g1).filter((p) => {
      const r = play(g1, p);
      return r.ok && r.facts.captured.length > 0;
    });
    expect(capturing.map((p) => toVertex(p, 5))).toEqual(['c4']);
    // The four cross-cuts: each of the four stones has exactly 2 liberties.
    for (const g of games.slice(1)) {
      const state = createGame(g.size, { setup: g.setup });
      const all = [...(g.setup.B ?? []), ...(g.setup.W ?? [])];
      expect(all).toHaveLength(4);
      for (const at of all)
        expect({ at, libs: groupAt(state.board, at)?.liberties.length }).toEqual({ at, libs: 2 });
    }
  });

  it('AC 42: every game has hintKey and explainKey and no hintPoints', () => {
    for (const g of games) {
      expect(g.hintKey).toBeTruthy();
      expect(g.explainKey).toBeTruthy();
      expect(g.hintPoints).toBeUndefined();
    }
  });

  it('§8.1: step 1 ends with Black c2 capturing c3; step 2 with White c4 capturing c3', () => {
    const [s1, s2, s3] = lesson.explain ?? [];
    const r1 = play(createGame(5, { setup: s1.board?.setup, toPlay: 'B' }), 'c2');
    expect(r1.ok && r1.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['c3']);
    const r2 = play(createGame(5, { setup: s2.board?.setup, toPlay: 'W' }), 'c4');
    expect(r2.ok && r2.facts.captured.flat().map((p) => toVertex(p, 5))).toEqual(['c3']);
    // Step 3 highlights exactly the eight liberties of the four stones.
    const s3state = createGame(5, { setup: s3.board?.setup });
    const libs = new Set(
      ['c3', 'd2', 'd3', 'c2'].flatMap(
        (at) => groupAt(s3state.board, at)?.liberties.map((p) => toVertex(p, 5)) ?? [],
      ),
    );
    expect([...libs].sort()).toEqual([...(s3.highlights?.[0].points ?? [])].sort());
  });
});

describe('F. map, stars and flow (AC 58–61)', () => {
  const units = getUnits();

  // Updated by M5 item 1: Units 7–9 follow; by M5 item 3: Units 10–11 follow, Unit 12 is planned;
  // by M5 item 4: Units 12–14 follow and nothing is planned.
  it('AC 58: units 1–6 all have a lesson, Unit 6 a checkpoint (Units 7–14 follow)', () => {
    expect(units.map((u) => u.unit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(units.every((u) => u.lesson !== null)).toBe(true);
    expect(units[5].checkpoint?.id).toBe('u06-checkpoint');
    expect(PLANNED_UNITS).toEqual([]);
  });

  it('AC 59: Unit 6 opens with 1★ on Unit 5; its checkpoint after 1★ on Unit 6', () => {
    const before = Object.fromEntries(UNITS_1_5.slice(0, 4).map((id) => [id, 1]));
    expect(isUnlocked(units, stars({ ...before, 'u05-atari': 0 }), 6)).toBe(false);
    expect(isUnlocked(units, stars({ ...before, 'u05-atari': 1 }), 6)).toBe(true);
    const five = { ...before, 'u05-atari': 1 };
    expect(isCheckpointUnlocked(units, stars(five), 6)).toBe(false);
    expect(isCheckpointUnlocked(units, stars({ ...five, 'u06-capture-go': 1 }), 6)).toBe(true);
    const rows = mapRows(units, stars({ ...five, 'u06-capture-go': 1 }));
    expect(rows.filter((r) => r.key.endsWith('-6')).map((r) => `${r.key}:${r.state}`)).toEqual([
      'unit-6:done',
      'checkpoint-6:available',
    ]);
  });

  it('AC 59: Continue walks 1…5, review, 6, checkpoint (then Units 7–14 since M5 items 1, 3, 4)', () => {
    const order = [
      ...UNITS_1_5,
      'u05-review',
      'u06-capture-go',
      'u06-checkpoint',
      'u07-forbidden',
      'u08-ko',
      'u09-ladder',
      'u09-review',
      'u10-eyes',
      'u11-two-eyes',
      'u11-vital',
      'u11-review',
      'u12-territory',
      'u13-counting',
      'u14-end',
      'u14-review',
    ];
    const progress: Record<string, number> = {};
    for (const id of order) {
      expect(nextNode(units, stars(progress))?.lesson.id).toBe(id);
      progress[id] = 1;
    }
    expect(nextNode(units, stars(progress))).toBeNull();
  });

  it.each([
    [['clean', 'clean', 'clean'], 3],
    [['clean', 'clean', 'solved'], 2],
    [['solved', 'solved', 'solved'], 2],
    [['solved', 'solved', 'revealed'], 1],
    [['solved', 'revealed', 'revealed'], 0],
    [['clean', 'clean'], 3],
    [['clean', 'solved'], 2],
    [['clean', 'revealed'], 1],
    [['revealed', 'revealed'], 0],
  ] as [Outcome[], number][])('AC 60: %j → %i★', (outcomes, expected) => {
    expect(computeStars(outcomes)).toBe(expected);
  });

  it('AC 61: Next after u05-review → u06-capture-go → u06-checkpoint → (M5) u07-forbidden', () => {
    const all = stars(
      Object.fromEntries(
        [...UNITS_1_5, 'u05-review', 'u06-capture-go', 'u06-checkpoint'].map((id) => [id, 1]),
      ),
    );
    expect(nodeAfter(units, all, 'u05-review')?.lesson.id).toBe('u06-capture-go');
    expect(nodeAfter(units, all, 'u06-capture-go')?.lesson.id).toBe('u06-checkpoint');
    expect(nodeAfter(units, all, 'u06-checkpoint')?.lesson.id).toBe('u07-forbidden');
  });
});
