// Lesson loader (spec §4.5, §4.6). Validates each file once, caches the result, never throws.
import { LESSON_FILES, LESSON_TEXTS } from './registry';
import type { Language, Lesson, LessonError, UnitEntry, ValidationContext } from './schema';
import { validateLesson } from './validate';

export type LoadResult =
  | { ok: true; lesson: Lesson }
  | { ok: false; reason: 'not-found' | 'invalid'; errors?: LessonError[] };

/**
 * Units shown as "coming soon" until their content exists (§4.6). Empty since M5 item 4 shipped
 * Units 12–14 (docs/specs/M5-territory-counting.md AC 2); the map footer still says more are coming.
 */
export const PLANNED_UNITS: readonly number[] = [];

export interface LessonLoader {
  loadLesson(id: string): LoadResult;
  listLessons(): Lesson[];
  getUnits(): UnitEntry[];
}

/** A text key is present when it is a non-empty string in that language. */
export function hasTextIn(texts: Readonly<Record<Language, Readonly<Record<string, string>>>>) {
  return (key: string, lang: Language) => {
    const value = texts[lang][key];
    return typeof value === 'string' && value.trim().length > 0;
  };
}

function rawId(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const id = (entry as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

/** Builds a loader over a list of raw lesson files (the app uses the registry). */
export function createLessonLoader(
  files: readonly unknown[],
  ctx: ValidationContext = {},
): LessonLoader {
  const cache = new Map<string, LoadResult>();

  function load(id: string): LoadResult {
    const entry = files.find((file) => rawId(file) === id);
    if (entry === undefined) {
      return { ok: false, reason: 'not-found' };
    }
    const cached = cache.get(id);
    if (cached) return cached;
    let result: LoadResult;
    try {
      const validation = validateLesson(entry, ctx);
      result = validation.ok
        ? { ok: true, lesson: validation.lesson }
        : { ok: false, reason: 'invalid', errors: validation.errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = { ok: false, reason: 'invalid', errors: [{ code: 'CRASH', path: '', message }] };
    }
    cache.set(id, result);
    return result;
  }

  function list(): Lesson[] {
    const lessons: Lesson[] = [];
    for (const file of files) {
      const id = rawId(file);
      const result = id === null ? null : load(id);
      if (result?.ok) lessons.push(result.lesson);
    }
    const order = (l: Lesson) => l.unit * 2 + (l.kind === 'lesson' ? 0 : 1);
    return lessons.sort((a, b) => order(a) - order(b));
  }

  function units(): UnitEntry[] {
    const lessons = list();
    const numbers = [...new Set([...lessons.map((l) => l.unit), ...PLANNED_UNITS])].sort(
      (a, b) => a - b,
    );
    return numbers.map((unit) => {
      const [lesson = null, ...laterLessons] = lessons.filter(
        (l) => l.unit === unit && l.kind === 'lesson',
      );
      const checkpoint = lessons.find((l) => l.unit === unit && l.kind === 'checkpoint') ?? null;
      const entry: UnitEntry = {
        unit,
        titleKey: `unit.${unit}.title`,
        lesson,
        checkpoint,
      };
      // Registry order within a unit (M5-life-death: u11-two-eyes, then u11-vital).
      if (laterLessons.length > 0) entry.laterLessons = laterLessons;
      return entry;
    });
  }

  return { loadLesson: load, listLessons: list, getUnits: units };
}

const appLoader = createLessonLoader(LESSON_FILES, { hasText: hasTextIn(LESSON_TEXTS) });

export const loadLesson = appLoader.loadLesson;
export const listLessons = appLoader.listLessons;
export const getUnits = appLoader.getUnits;
