// 9×9 games against the bot (spec docs/specs/M6-bot-levels.md §3, §12 c, g): the constants the
// PO sees and the future settings item may change.
import type { BotLevel } from '@/bot';

/** Komi (贴目 tiēmù) for the learner's 9×9 games; the engine default for 9×9 stays 7.5. */
export const GAME_KOMI_9 = 5.5;

/** Level 1 (入门 Easy) blunder on 9×9: misses a capture with half this (§6.1, AC 8 tuning). */
export const L1_BLUNDER_9 = 0.6;

export const BOT_LEVELS: readonly BotLevel[] = [1, 2, 3];

/** Level 1 on 9×9 does not save its own group in atari with this chance (M6-beginner-friendly AC 37). */
export const L1_SKIP_SAVE_9 = 0.5;
/** Level 1 on 9×9 skips putting an opponent group in atari with this chance (AC 37). */
export const L1_SKIP_ATARI_9 = 0.5;
/** Level 2 on 9×9 plays its 2nd or 3rd best point with this chance (AC 39). */
export const L2_SLIP_9 = 0.7;

/** Take-backs 悔棋 per game (AC 15–24); null = unlimited. */
export const TAKEBACKS_PER_GAME: Readonly<Record<BotLevel, number | null>> = {
  1: null,
  2: 3,
  3: 1,
};
