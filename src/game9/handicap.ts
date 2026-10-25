// Handicap 让子 ràngzǐ for the learner's games (spec docs/specs/M6-beginner-friendly.md §3,
// AC 1, 9–11, 14; 13×13 in docs/specs/M6b-13x13-game.md AC 8–10, 13–16). Pure: no React, no
// store; the progress store and the picker call these.
import type { BotLevel } from '@/bot';
import type { Vertex } from '@/engine';
import type { BotProgress } from '@/store/progress';

import type { GameSize } from './config';

export type Handicap = 0 | 2 | 3 | 4 | 5;

/** The picker's chips, in order: even game, then 2–5 stones (1 stone is not offered). */
export const HANDICAP_CHOICES: readonly Handicap[] = [0, 2, 3, 4, 5];

/**
 * The star points 星位 xīngwèi in the order they are added (§3): lower-left, upper-right,
 * lower-right, upper-left, then the centre (天元 tiānyuán on 13×13, M6b AC 8).
 */
const STAR_POINTS: Readonly<Record<GameSize, readonly Vertex[]>> = {
  9: ['c3', 'g7', 'g3', 'c7', 'e5'],
  13: ['d4', 'k10', 'k4', 'd10', 'g7'],
};

/** Komi 贴目 of a handicap game (§3: no draws, "so close"). Even games keep GAME_KOMI_9. */
export const HANDICAP_KOMI = 0.5;

/**
 * The first suggestion per level when nothing is stored (AC 9). From the tuning of §6: the
 * smallest n where the weak reference player Noob wins ≥ 60 % (5 when never reached).
 */
export const STARTING_HANDICAP: Readonly<Record<BotLevel, Handicap>> = { 1: 2, 2: 5, 3: 5 };
/** 13×13 (M6b AC 13, §11 decision 3): provisional, tuned in M6b-2. */
export const STARTING_HANDICAP_13: Readonly<Record<BotLevel, Handicap>> = { 1: 2, 2: 5, 3: 5 };

/** The starting table of a board size. */
export function startingHandicap(size: GameSize): Readonly<Record<BotLevel, Handicap>> {
  return size === 13 ? STARTING_HANDICAP_13 : STARTING_HANDICAP;
}

export function isHandicap(value: unknown): value is Handicap {
  return HANDICAP_CHOICES.includes(value as Handicap);
}

/**
 * The Black stones of an n-stone handicap on a board size (AC 1, M6b AC 8, 10); throws for
 * anything but 0, 2, 3, 4, 5 and for a size without a table.
 */
export function handicapStones(size: GameSize, n: number): Vertex[] {
  const points = STAR_POINTS[size];
  if (!points) throw new Error(`game9: no handicap table for ${size}×${size}`);
  if (!isHandicap(n)) throw new Error(`game9: no ${n}-stone handicap`);
  return n === 0 ? [] : points.slice(0, n);
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

/**
 * The stored suggestion of a level, or the starting table (AC 9, 10). `bots` is the record of
 * that board size (`bots` for 9×9, `bots13` for 13×13, M6b AC 13–16).
 */
export function suggestedHandicap(
  bots: BotProgress,
  level: BotLevel,
  size: GameSize = 9,
): Handicap {
  const stored = bots[String(level) as '1' | '2' | '3']?.handicap;
  return isHandicap(stored) ? stored : startingHandicap(size)[level];
}

/** The next suggestion after a finished game (AC 11): a win removes a stone, a loss adds one. */
export function nextHandicap(h: Handicap, outcome: 'win' | 'loss' | 'resigned'): Handicap {
  return outcome === 'win' ? stepDown(h) : stepUp(h);
}
