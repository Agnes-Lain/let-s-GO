/**
 * AC 28: every shipped lesson validates with the real texts, the catalog is consistent, and every
 * text fits the 4-line text card (≤ 160 characters in en/fr, ≤ 70 in zh-CN).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasTextIn } from './loader';
import { LESSON_FILES, LESSON_TEXTS } from './registry';
import type { Lesson } from './schema';
import { validateCatalog, validateLesson } from './validate';

const dir = join(__dirname, 'content');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const lessons = files.map((file) => ({
  file,
  json: JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown,
}));

const LIMITS = { 'zh-CN': 70, en: 160, fr: 160 } as const;

function textKeys(lesson: unknown): string[] {
  const keys: string[] = [];
  JSON.stringify(lesson, (name, value) => {
    if (/Key$/.test(name) && typeof value === 'string') keys.push(value);
    return value;
  });
  return keys;
}

describe('lesson content (AC 28)', () => {
  it('has at least the sample', () => {
    expect(files).toContain('u00-sample.json');
  });

  it('registers every content file', () => {
    expect(LESSON_FILES).toHaveLength(files.length);
  });

  it.each(lessons)('$file is valid with the real texts', ({ json }) => {
    const result = validateLesson(json, { hasText: hasTextIn(LESSON_TEXTS) });
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(lessons)('$file is named after its id', ({ file, json }) => {
    expect(file).toBe(`${(json as Lesson).id}.json`);
  });

  it('the catalog is consistent', () => {
    expect(validateCatalog(lessons.map((l) => l.json as Lesson))).toEqual({ ok: true });
  });

  it.each(lessons)('$file texts fit the text card', ({ json }) => {
    for (const key of textKeys(json)) {
      for (const lang of ['zh-CN', 'en', 'fr'] as const) {
        const text = LESSON_TEXTS[lang][key] ?? '';
        expect({ key, lang, tooLong: [...text].length > LIMITS[lang] }).toEqual({
          key,
          lang,
          tooLong: false,
        });
      }
    }
  });
});

describe('no sequence exercise ships before its runner (M5-sgf-import AC 29)', () => {
  it('no registered lesson contains a sequence exercise', () => {
    const found = (LESSON_FILES as Lesson[]).flatMap((lesson) =>
      lesson.exercises.filter((e) => e.type === 'sequence').map((e) => `${lesson.id}/${e.id}`),
    );
    expect(found).toEqual([]);
  });
});
