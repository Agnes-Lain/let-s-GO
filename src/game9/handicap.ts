// Handicap 让子 ràngzǐ for the learner's 9×9 games (spec docs/specs/M6-beginner-friendly.md §3,
// AC 1, 9–11, 14). Pure: no React, no store; the progress store and the picker call these.
import type { BotLevel } from '@/bot';
import type { Vertex } from '@/engine';
import type { BotProgress } from '@/store/progress';

export type Handicap = 0 | 2 | 3 | 4 | 5;

/** The picker's chips, in order: even game, then 2–5 stones (1 stone is not offered). */
export const HANDICAP_CHOICES: readonly Handicap[] = [0, 2, 3, 4, 5];

/** The star points 星位 in the order they are added (§3). */
const STAR_POINTS: readonly Vertex[] = ['c3', 'g7', 'g3', 'c7', 'e5'];

/** Komi 贴目 of a handicap game (§3: no draws, "so close"). Even games keep GAME_KOMI_9. */
export const HANDICAP_KOMI = 0.5;

/**
 * The first suggestion per level when nothing is stored (AC 9). From the tuning of §6: the
 * smallest n where the weak reference player Noob wins ≥ 60 % (5 when never reached).
 */
export const STARTING_HANDICAP: Readonly<Record<BotLevel, Handicap>> = { 1: 3, 2: 4, 3: 5 };

export function isHandicap(value: unknown): value is Handicap {
  return HANDICAP_CHOICES.includes(value as Handicap);
}

/** The Black stones of an n-stone handicap (AC 1); throws for anything but 0, 2, 3, 4, 5. */
export function handicapStones(n: number): Vertex[] {
  if (!isHandicap(n)) throw new Error(`game9: no ${n}-stone handicap`);
  return n === 0 ? [] : STAR_POINTS.slice(0, n);
}

/** One stone fewer after a win: 5 → 4 → 3 → 2 → even (AC 11). */
export function stepDown(h: Handicap): Handicap {
  const i = HANDICAP_CHOICES.indexOf(h);
  return HANDICAP_CHOICES[Math.max(0, i - 1)];
}

/** One stone more after a loss or resignation: even → 2 → … → 5 (AC 11). */
export function stepUp(h: Handicap): Handicap {
  const i = HANDICAP_CHOICES.indexOf(h);
  return HANDICAP_CHOICES[Math.min(HANDICAP_CHOICES.length - 1, i + 1)];
}

/** The stored suggestion of a level, or the starting table (AC 9, 10). */
export function suggestedHandicap(bots: BotProgress, level: BotLevel): Handicap {
  const stored = bots[String(level) as '1' | '2' | '3']?.handicap;
  return isHandicap(stored) ? stored : STARTING_HANDICAP[level];
}

/** The next suggestion after a finished game (AC 11): a win removes a stone, a loss adds one. */
export function nextHandicap(h: Handicap, outcome: 'win' | 'loss' | 'resigned'): Handicap {
  return outcome === 'win' ? stepDown(h) : stepUp(h);
}
