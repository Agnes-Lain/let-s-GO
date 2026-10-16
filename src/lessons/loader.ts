// Lesson loader (spec §4.5, §4.6). Validates each file once, caches the result, never throws.
import { LESSON_FILES, LESSON_TEXTS } from './registry';
import type { Language, Lesson, LessonError, UnitEntry, ValidationContext } from './schema';
import { SAMPLE_UNIT } from './unlock';
import { validateLesson } from './validate';

export type LoadResult =
  | { ok: true; lesson: Lesson }
  | { ok: false; reason: 'not-found' | 'invalid'; errors?: LessonError[] };

export interface ListOptions {
  /** Include the unit-0 sample. Defaults to `__DEV__` (the Expo Go build). */
  includeDev?: boolean;
}

/** Units shown as "coming soon" until their content exists (§4.6). */
export const PLANNED_UNITS: readonly number[] = [1, 2, 3, 4, 5, 6];

export interface LessonLoader {
  loadLesson(id: string, opts?: ListOptions): LoadResult;
  listLessons(opts?: ListOptions): Lesson[];
  getUnits(opts?: ListOptions): UnitEntry[];
}

/** A text key is present when it is a non-empty string in that language. */
export function hasTextIn(texts: Readonly<Record<Language, Readonly<Record<string, string>>>>) {
  return (key: string, lang: Language) => {
    const value = texts[lang][key];
    return typeof value === 'string' && value.trim().length > 0;
  };
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function rawId(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const id = (entry as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function rawUnit(entry: unknown): unknown {
  return typeof entry === 'object' && entry !== null ? (entry as { unit?: unknown }).unit : null;
}

/** Builds a loader over a list of raw lesson files (the app uses the registry). */
export function createLessonLoader(
  files: readonly unknown[],
  ctx: ValidationContext = {},
): LessonLoader {
  const cache = new Map<string, LoadResult>();

  function load(id: string, opts: ListOptions = {}): LoadResult {
    const includeDev = opts.includeDev ?? isDevBuild();
    const entry = files.find((file) => rawId(file) === id);
    if (entry === undefined || (!includeDev && rawUnit(entry) === SAMPLE_UNIT)) {
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

  function list(opts: ListOptions = {}): Lesson[] {
    const lessons: Lesson[] = [];
    for (const file of files) {
      const id = rawId(file);
      const result = id === null ? null : load(id, opts);
      if (result?.ok) lessons.push(result.lesson);
    }
    const order = (l: Lesson) => l.unit * 2 + (l.kind === 'lesson' ? 0 : 1);
    return lessons.sort((a, b) => order(a) - order(b));
  }

  function units(opts: ListOptions = {}): UnitEntry[] {
    const lessons = list(opts);
    const numbers = [...new Set([...lessons.map((l) => l.unit), ...PLANNED_UNITS])].sort(
      (a, b) => a - b,
    );
    return numbers.map((unit) => {
      const lesson = lessons.find((l) => l.unit === unit && l.kind === 'lesson') ?? null;
      const checkpoint = lessons.find((l) => l.unit === unit && l.kind === 'checkpoint') ?? null;
      return {
        unit,
        titleKey: lesson?.titleKey ?? `unit.${unit}.title`,
        lesson,
        checkpoint,
      };
    });
  }

  return { loadLesson: load, listLessons: list, getUnits: units };
}

const appLoader = createLessonLoader(LESSON_FILES, { hasText: hasTextIn(LESSON_TEXTS) });

export const loadLesson = appLoader.loadLesson;
export const listLessons = appLoader.listLessons;
export const getUnits = appLoader.getUnits;
