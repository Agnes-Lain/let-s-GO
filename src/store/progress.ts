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

/** Games against one bot level on one board size (M6 §7, AC 34–37; 13×13 in M6b AC 14–16). */
export interface BotRecord {
  games: number;
  wins: number;
  /** ISO timestamp of the first win. */
  firstWinAt?: string;
  /** Losses (or resignations) in a row since the last win (AC 37). */
  lossStreak: number;
  /**
   * The suggested handicap 让子 for the next game (M6-beginner-friendly AC 10–11); optional. The
   * value is checked where it is read (`suggestedHandicap` in src/game9/handicap.ts).
   */
  handicap?: number;
}

export type BotLevelKey = '1' | '2' | '3';
export type BotProgress = Partial<Record<BotLevelKey, BotRecord>>;

/** One-time tips (M6 AC 19, 37). */
export interface ProgressFlags {
  /** The first-Pass explainer sheet was shown. */
  passExplained?: boolean;
  /** The "Try Easy for a warm-up?" tip was shown. */
  easierTipShown?: boolean;
  /** The first take-back 悔棋 showed the longer note (M6-beginner-friendly AC 15). */
  takebackExplained?: boolean;
  /** The learner switched the danger rings and atari line off (setting, can be undone). */
  atariHintsOff?: boolean;
  /** The first-launch intro was left by Finish, Skip or Back (M6-settings AC 25–28). */
  onboardingSeen?: boolean;
  /** The last board size chosen on the opponent screen (M6b AC 1); absent = 9×9. */
  gameSize?: 13;
}

/** The on/off flags (every flag except the remembered board size). */
export type BooleanFlag = Exclude<keyof ProgressFlags, 'gameSize'>;

/** The board sizes of games against the bot. */
export type GameBoardSize = 9 | 13;

const FLAG_NAMES: readonly BooleanFlag[] = [
  'passExplained',
  'easierTipShown',
  'takebackExplained',
  'atariHintsOff',
  'onboardingSeen',
];

/**
 * Lessons that no longer ship: their saved records are dropped when the store is read (M6-settings
 * AC 51, the removed unit-0 developer sample).
 */
export const REMOVED_LESSON_IDS: readonly string[] = ['u00-sample'];

export interface ResetOptions {
  /** Flags that survive the reset (Settings → Erase keeps atariHintsOff and onboardingSeen). */
  keepFlags?: readonly BooleanFlag[];
}

export type GameOutcome = 'win' | 'loss' | 'resigned';

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
  /** 9×9 games per bot level; additive (old saves load with `{}`). */
  bots: BotProgress;
  /** 13×13 games per bot level (M6b AC 14–17), kept apart from `bots`; old saves load `{}`. */
  bots13: BotProgress;
  flags: ProgressFlags;
  /**
   * Saves a finished game (a resignation is a loss, AC 22, 34) and, when given, the next
   * handicap suggestion of that level (M6-beginner-friendly AC 11; the caller steps the ladder).
   * `size` 13 writes `bots13`, never `bots` (M6b AC 14, 16).
   */
  recordGame(
    level: 1 | 2 | 3,
    outcome: GameOutcome,
    nextHandicap?: number,
    size?: GameBoardSize,
  ): void;
  /** Wins against a bot level, 0 when never played. */
  botWins(level: 1 | 2 | 3): number;
  /** Remembers that a one-time tip was shown. */
  /** Sets a flag (or clears it with `false`). */
  setFlag(flag: BooleanFlag, value?: boolean): void;
  /** Remembers the board size of the opponent screen (M6b AC 1). */
  setGameSize(size: GameBoardSize): void;
  /** Saves a finished practice set. */
  record(lessonId: string, outcomes: readonly Outcome[]): RecordResult;
  /** Best stars of a lesson, 0 when never played. */
  starsOf(lessonId: string): Stars;
  /** Forgets everything (and the storage key), except the `keepFlags` (then the key is rewritten). */
  reset(options?: ResetOptions): void;
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

function isBotRecord(value: unknown): value is BotRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    isCount(r.games) &&
    isCount(r.wins) &&
    isCount(r.lossStreak) &&
    (r.firstWinAt === undefined || typeof r.firstWinAt === 'string')
  );
}

export interface SavedProgress {
  lessons: LessonProgressMap;
  bots: BotProgress;
  bots13: BotProgress;
  flags: ProgressFlags;
}

/** The valid bot records of a saved value (M6 AC 35: a broken part loads as empty). */
function parseBots(bots: unknown): BotProgress {
  const out: BotProgress = {};
  if (typeof bots !== 'object' || bots === null) return out;
  for (const key of ['1', '2', '3'] as BotLevelKey[]) {
    const entry = (bots as Record<string, unknown>)[key];
    if (!isBotRecord(entry)) continue;
    // A broken suggestion is dropped (the starting table applies), the record kept (AC 10).
    const { handicap, ...record } = entry;
    out[key] = isCount(handicap) ? { ...record, handicap } : record;
  }
  return out;
}

/** Everything saved, or null when the value is missing, corrupt or of another version. */
export function parseSaved(raw: string | null): SavedProgress | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { v, lessons, bots, bots13, flags } = data as Record<string, unknown>;
  if (v !== PROGRESS_VERSION) return null;
  if (typeof lessons !== 'object' || lessons === null || Array.isArray(lessons)) return null;
  const out: SavedProgress = {
    lessons: {},
    bots: parseBots(bots),
    bots13: parseBots(bots13),
    flags: {},
  };
  for (const [id, entry] of Object.entries(lessons)) {
    if (isLessonProgress(entry) && !REMOVED_LESSON_IDS.includes(id)) out.lessons[id] = entry;
  }
  if (typeof flags === 'object' && flags !== null) {
    const f = flags as Record<string, unknown>;
    for (const name of FLAG_NAMES) if (f[name] === true) out.flags[name] = true;
    if (f.gameSize === 13) out.flags.gameSize = 13;
  }
  return out;
}

/** The saved lessons, or null when the value is missing, corrupt or of another version. */
export function parseProgress(raw: string | null): LessonProgressMap | null {
  return parseSaved(raw)?.lessons ?? null;
}

export function serializeProgress(
  lessons: LessonProgressMap,
  bots: BotProgress = {},
  flags: ProgressFlags = {},
  bots13: BotProgress = {},
): string {
  return JSON.stringify({
    v: PROGRESS_VERSION,
    lessons,
    ...(Object.keys(bots).length > 0 ? { bots } : {}),
    ...(Object.keys(bots13).length > 0 ? { bots13 } : {}),
    ...(Object.keys(flags).length > 0 ? { flags } : {}),
  });
}

function mergeBot(a: BotRecord, b: BotRecord): BotRecord {
  const firstWins = [a.firstWinAt, b.firstWinAt].filter((t): t is string => t !== undefined);
  return {
    games: a.games + b.games,
    wins: a.wins + b.wins,
    lossStreak: b.games > 0 ? b.lossStreak : a.lossStreak,
    ...(b.handicap !== undefined || a.handicap !== undefined
      ? { handicap: b.handicap ?? (a.handicap as number) }
      : {}),
    ...(firstWins.length > 0 ? { firstWinAt: firstWins.sort()[0] } : {}),
  };
}

/** The saved bot records with the ones played before hydration added on top. */
function mergeBots(saved: BotProgress, current: BotProgress): BotProgress {
  const out: BotProgress = { ...saved };
  for (const [key, entry] of Object.entries(current) as [BotLevelKey, BotRecord][]) {
    const old = saved[key];
    out[key] = old ? mergeBot(old, entry) : entry;
  }
  return out;
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
  const save = () => {
    const { lessons, bots, bots13, flags } = store.getState();
    ignoreRejection(storage.setItem(PROGRESS_KEY, serializeProgress(lessons, bots, flags, bots13)));
  };

  const store: ProgressStore = createStore<ProgressState>()((set, get) => ({
    hydrated: false,
    lessons: {},
    bots: {},
    bots13: {},
    flags: {},

    recordGame(level, outcome, nextHandicap, size = 9) {
      const key = String(level) as BotLevelKey;
      const field = size === 13 ? 'bots13' : 'bots';
      const before = get()[field][key] ?? { games: 0, wins: 0, lossStreak: 0 };
      const won = outcome === 'win';
      const entry: BotRecord = {
        games: before.games + 1,
        wins: before.wins + (won ? 1 : 0),
        lossStreak: won ? 0 : before.lossStreak + 1,
        ...(nextHandicap !== undefined
          ? { handicap: nextHandicap }
          : before.handicap !== undefined
            ? { handicap: before.handicap }
            : {}),
        ...(before.firstWinAt || won
          ? { firstWinAt: before.firstWinAt ?? now().toISOString() }
          : {}),
      };
      set({ [field]: { ...get()[field], [key]: entry } });
      save();
    },

    botWins(level) {
      return get().bots[String(level) as BotLevelKey]?.wins ?? 0;
    },

    setFlag(flag, value = true) {
      if (Boolean(get().flags[flag]) === value) return;
      const flags = { ...get().flags };
      if (value) flags[flag] = true;
      else delete flags[flag];
      set({ flags });
      save();
    },

    setGameSize(size) {
      if ((get().flags.gameSize ?? 9) === size) return;
      const flags = { ...get().flags };
      if (size === 13) flags.gameSize = 13;
      else delete flags.gameSize;
      set({ flags });
      save();
    },

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
      save();
      return {
        stars,
        previousStars: previous?.stars ?? 0,
        unlockedUnit: newlyUnlockedUnit(units(), before, lessons),
      };
    },

    starsOf(lessonId) {
      return get().lessons[lessonId]?.stars ?? 0;
    },

    reset({ keepFlags = [] } = {}) {
      const flags: ProgressFlags = {};
      for (const name of keepFlags) if (get().flags[name]) flags[name] = true;
      set({ lessons: {}, bots: {}, bots13: {}, flags });
      if (Object.keys(flags).length > 0) save();
      else ignoreRejection(storage.removeItem(PROGRESS_KEY));
    },
  }));

  const hydrate = (raw: string | null) => {
    const saved = parseSaved(raw) ?? { lessons: {}, bots: {}, bots13: {}, flags: {} };
    const current = store.getState();
    const lessons: LessonProgressMap = { ...saved.lessons };
    for (const [id, entry] of Object.entries(current.lessons)) {
      lessons[id] = saved.lessons[id] ? mergeEntry(saved.lessons[id], entry) : entry;
    }
    const bots = mergeBots(saved.bots, current.bots);
    const bots13 = mergeBots(saved.bots13, current.bots13);
    const flags: ProgressFlags = { ...saved.flags, ...current.flags };
    store.setState({ lessons, bots, bots13, flags, hydrated: true });
    const changed =
      Object.keys(current.lessons).length > 0 ||
      Object.keys(current.bots).length > 0 ||
      Object.keys(current.bots13).length > 0 ||
      Object.keys(current.flags).length > 0;
    if (changed) save();
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
