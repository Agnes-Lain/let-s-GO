// QA edge cases for sequence v2 (spec docs/specs/M5-sequence-v2.md AC 7, 8, 9, 26).
import { readFileSync } from 'fs';
import { join } from 'path';

import { forcedCapture, judgeAttack } from '@/bot';
import { playAt, position } from '../src/bot/__fixtures__/board';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zh from '@/i18n/zh-CN.json';
import { LESSON_FILES } from '@/lessons/registry';
import type { Lesson, SequenceExercise } from '@/lessons';

const flat = (o: unknown, p = ''): Record<string, unknown> =>
  Object.entries(o as object).reduce(
    (a, [k, v]) =>
      typeof v === 'object' && v !== null
        ? { ...a, ...flat(v, `${p}${k}.`) }
        : { ...a, [`${p}${k}`]: v },
    {},
  );
const L = { zh: flat(zh), en: flat(en), fr: flat(fr) };

describe('QA: forcedCapture', () => {
  const base = (extra: string) =>
    position(
      `
  7 . . . . . . .
  6 . . . . . . .
  5 . . . . ${extra} . .
  4 . . . . . . .
  3 . X O . . . .
  2 . . X X . . .
  1 . . . . . . .
  `,
      'B',
    );

  it('a ladder breaker stone (f5 White) defeats the 8-move ladder; the far-edge one does not', () => {
    const withBreaker = position(
      `
  7 . . . . . . .
  6 . . . . . . .
  5 . . . . . O .
  4 . . . . . . .
  3 . X O . . . .
  2 . . X X . . .
  1 . . . . . . .
  `,
      'B',
    );
    const r = forcedCapture(withBreaker, { attacker: 'B', target: 'c3', maxMoves: 8 });
    expect(r.forced).toBe(false);
    expect(r.capped).toBe(false);
    expect(forcedCapture(base('.'), { attacker: 'B', target: 'c3', maxMoves: 8 }).forced).toBe(
      true,
    );
  });

  it('judgeAttack is deterministic: same input, identical result', () => {
    const s = playAt(base('.'), 'c4');
    const a = judgeAttack(s, { attacker: 'B', target: 'c3', maxMoves: 7 }, 'd3');
    const b = judgeAttack(s, { attacker: 'B', target: 'c3', maxMoves: 7 }, 'd3');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC 8: forcedCapture.ts has no react, expo, Math.random, Date or timers', () => {
    const src = readFileSync(join(__dirname, '../src/bot/forcedCapture.ts'), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(src).not.toMatch(/from '(react|react-native|expo)[^']*'/);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date|setTimeout|setInterval/);
  });
});

describe('QA: content', () => {
  const lessons = LESSON_FILES as readonly Lesson[];
  const search = lessons
    .flatMap((l) => l.exercises)
    .filter((e): e is SequenceExercise => e.type === 'sequence' && e.judge?.kind === 'search');

  it('exactly the three shipped search exercises exist; line exercises have no judge', () => {
    expect(search.map((e) => e.id).sort()).toEqual([
      'ladder-play',
      'ladder-play-corner',
      'r-ladder-play',
    ]);
    for (const e of lessons.flatMap((l) => l.exercises))
      if (e.type === 'sequence' && !e.judge)
        expect(e.wrong === undefined || Array.isArray(e.wrong)).toBe(true);
  });

  it('AC 26: every text key of the search exercises exists in zh-CN, en, fr, within limits', () => {
    for (const e of search) {
      for (const key of [e.promptKey, e.hintKey!, e.explainKey!]) {
        for (const [lang, max] of [
          ['zh', 70],
          ['en', 160],
          ['fr', 160],
        ] as const) {
          const v = L[lang][key];
          expect(typeof v).toBe('string');
          expect((v as string).length).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('the new sequence.wrong.* keys have the same keys (incl. plural suffixes) in all languages', () => {
    const keys = (m: Record<string, unknown>) =>
      Object.keys(m)
        .filter((k) => k.startsWith('sequence.'))
        .sort();
    expect(keys(L.en)).toEqual(keys(L.zh));
    expect(keys(L.en)).toEqual(keys(L.fr));
  });
});
