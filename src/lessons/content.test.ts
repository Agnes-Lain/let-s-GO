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
  it('ships Unit 1 and no unit-0 developer sample (M6-settings AC 50)', () => {
    expect(files).toContain('u01-board.json');
    expect(files).not.toContain('u00-sample.json');
    expect(LESSON_FILES.some((f) => (f as { unit?: unknown }).unit === 0)).toBe(false);
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
