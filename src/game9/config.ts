// 9×9 games against the bot (spec docs/specs/M6-bot-levels.md §3, §12 c, g): the constants the
// PO sees and the future settings item may change.
import type { BotLevel } from '@/bot';

/** Komi (贴目 tiēmù) for the learner's 9×9 games; the engine default for 9×9 stays 7.5. */
export const GAME_KOMI_9 = 5.5;
/** Komi of an even 13×13 game (M6b §11 decision 1): a half point, so there is never a draw. */
export const GAME_KOMI_13 = 6.5;

/** The board sizes of games against the bot (M6b): 9×9 and 13×13. */
export type GameSize = 9 | 13;
export const GAME_SIZES: readonly GameSize[] = [9, 13];

/** Komi of an even game on a board size. */
export function gameKomi(size: GameSize): number {
  return size === 13 ? GAME_KOMI_13 : GAME_KOMI_9;
}

/** Level 1 (入门 Easy) blunder on 9×9: misses a capture with half this (§6.1, AC 8 tuning). */
export const L1_BLUNDER_9 = 0.6;

export const BOT_LEVELS: readonly BotLevel[] = [1, 2, 3];

/** Level 1 on 9×9 does not save its own group in atari with this chance (M6-beginner-friendly AC 37). */
export const L1_SKIP_SAVE_9 = 0.5;
/** Level 1 on 9×9 skips putting an opponent group in atari with this chance (AC 37). */
export const L1_SKIP_ATARI_9 = 0.5;
/** Level 2 on 9×9 plays its 2nd or 3rd best point with this chance (AC 39). */
export const L2_SLIP_9 = 0.7;

/** 13×13 (M6b-2 AC 11): the same knobs, tuned for the bigger board (`npm run tune:bot13`). */
export const L1_BLUNDER_13 = 0.3;
export const L1_SKIP_SAVE_13 = 0.3;
export const L1_SKIP_ATARI_13 = 0.3;
export const L2_SLIP_13 = 0.5;

/** The mistake knobs of a level's bot on a board size (passed to `chooseMove`). */
export interface LevelKnobs {
  blunder: number;
  skipSave: number;
  skipAtari: number;
  slip: number;
}

export function levelKnobs(level: BotLevel, size: GameSize): LevelKnobs {
  const big = size === 13;
  return {
    blunder: level === 1 ? (big ? L1_BLUNDER_13 : L1_BLUNDER_9) : 0,
    skipSave: level === 1 ? (big ? L1_SKIP_SAVE_13 : L1_SKIP_SAVE_9) : 0,
    skipAtari: level === 1 ? (big ? L1_SKIP_ATARI_13 : L1_SKIP_ATARI_9) : 0,
    slip: level === 2 ? (big ? L2_SLIP_13 : L2_SLIP_9) : 0,
  };
}

/** Take-backs 悔棋 per game (AC 15–24); null = unlimited. */
export const TAKEBACKS_PER_GAME: Readonly<Record<BotLevel, number | null>> = {
  1: null,
  2: 3,
  3: 1,
};
