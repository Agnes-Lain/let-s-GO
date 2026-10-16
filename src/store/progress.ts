// Progress store (spec §5, ACs 31–44): best stars per lesson, saved on the phone.
// Unlocks are derived from stars (src/lessons/unlock.ts), never stored.
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  computeStars,
  countOutcomes,
  newlyUnlockedUnit,
  type Outcome,
  type Stars,
  type UnitEntry,
} from '@/lessons';

import type { StorageAdapter } from './storage';

export const PROGRESS_KEY = 'progress';
export const PROGRESS_VERSION = 1;

export interface LessonProgress {
  /** Best stars ever (a replay never lowers them). */
  stars: Stars;
  plays: number;
  /** Best number of first-try answers in one run. */
  bestClean: number;
  /** Best number of answers solved without being shown, in one run. */
  bestSolved: number;
  /** Exercises in the set at the last run. */
  total: number;
  /** ISO timestamp of the last finished run. */
  lastPlayedAt: string;
}

export type LessonProgressMap = Record<string, LessonProgress>;

export interface RecordResult {
  /** Stars of this run (not the best). */
  stars: Stars;
  /** Best stars before this run. */
  previousStars: Stars;
  /** The unit this run opened, if any. */
  unlockedUnit: number | null;
}

export interface ProgressState {
  /** False until the storage has been read. */
  hydrated: boolean;
  lessons: LessonProgressMap;
  /** Saves a finished practice set. */
  record(lessonId: string, outcomes: readonly Outcome[]): RecordResult;
  /** Best stars of a lesson, 0 when never played. */
  starsOf(lessonId: string): Stars;
  /** Forgets everything (and the storage key). */
  reset(): void;
}

export type ProgressStore = StoreApi<ProgressState>;

export interface ProgressStoreOptions {
  storage: StorageAdapter;
  /** The map's units, used to tell which unit a run unlocked. */
  units?: () => readonly UnitEntry[];
  now?: () => Date;
}

function isStars(value: unknown): value is Stars {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isLessonProgress(value: unknown): value is LessonProgress {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    isStars(p.stars) &&
    isCount(p.plays) &&
    isCount(p.bestClean) &&
    isCount(p.bestSolved) &&
    isCount(p.total) &&
    typeof p.lastPlayedAt === 'string'
  );
}

/** The saved lessons, or null when the value is missing, corrupt or of another version. */
export function parseProgress(raw: string | null): LessonProgressMap | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { v, lessons } = data as { v?: unknown; lessons?: unknown };
  if (v !== PROGRESS_VERSION) return null;
  if (typeof lessons !== 'object' || lessons === null || Array.isArray(lessons)) return null;
  const out: LessonProgressMap = {};
  for (const [id, entry] of Object.entries(lessons)) {
    if (isLessonProgress(entry)) out[id] = entry;
  }
  return out;
}

export function serializeProgress(lessons: LessonProgressMap): string {
  return JSON.stringify({ v: PROGRESS_VERSION, lessons });
}

/** Keeps the best of two records of the same lesson (used when a run finishes before hydration). */
function mergeEntry(a: LessonProgress, b: LessonProgress): LessonProgress {
  const latest = a.lastPlayedAt >= b.lastPlayedAt ? a : b;
  return {
    stars: Math.max(a.stars, b.stars) as Stars,
    plays: a.plays + b.plays,
    bestClean: Math.max(a.bestClean, b.bestClean),
    bestSolved: Math.max(a.bestSolved, b.bestSolved),
    total: latest.total,
    lastPlayedAt: latest.lastPlayedAt,
  };
}

function ignoreRejection(result: void | Promise<void>): void {
  if (result instanceof Promise) result.catch(() => undefined);
}

export function createProgressStore({
  storage,
  units = () => [],
  now = () => new Date(),
}: ProgressStoreOptions): ProgressStore {
  const store = createStore<ProgressState>()((set, get) => ({
    hydrated: false,
    lessons: {},

    record(lessonId, outcomes) {
      const before = get().lessons;
      const previous = before[lessonId];
      const stars = computeStars(outcomes);
      const { clean, solved, total } = countOutcomes(outcomes);
      const entry: LessonProgress = {
        stars: Math.max(stars, previous?.stars ?? 0) as Stars,
        plays: (previous?.plays ?? 0) + 1,
        bestClean: Math.max(clean, previous?.bestClean ?? 0),
        bestSolved: Math.max(solved, previous?.bestSolved ?? 0),
        total,
        lastPlayedAt: now().toISOString(),
      };
      const lessons = { ...before, [lessonId]: entry };
      set({ lessons });
      ignoreRejection(storage.setItem(PROGRESS_KEY, serializeProgress(lessons)));
      return {
        stars,
        previousStars: previous?.stars ?? 0,
        unlockedUnit: newlyUnlockedUnit(units(), before, lessons),
      };
    },

    starsOf(lessonId) {
      return get().lessons[lessonId]?.stars ?? 0;
    },

    reset() {
      set({ lessons: {} });
      ignoreRejection(storage.removeItem(PROGRESS_KEY));
    },
  }));

  const hydrate = (raw: string | null) => {
    const saved = parseProgress(raw) ?? {};
    const current = store.getState().lessons;
    const lessons: LessonProgressMap = { ...saved };
    for (const [id, entry] of Object.entries(current)) {
      lessons[id] = saved[id] ? mergeEntry(saved[id], entry) : entry;
    }
    store.setState({ lessons, hydrated: true });
    if (Object.keys(current).length > 0) {
      ignoreRejection(storage.setItem(PROGRESS_KEY, serializeProgress(lessons)));
    }
  };

  let raw: string | null | Promise<string | null>;
  try {
    raw = storage.getItem(PROGRESS_KEY);
  } catch {
    raw = null;
  }
  if (raw instanceof Promise) {
    raw.then(hydrate, () => hydrate(null));
  } else {
    hydrate(raw);
  }
  return store;
}
