// 9×9 games against the bot (spec docs/specs/M6-bot-levels.md §3, §12 c, g): the constants the
// PO sees and the future settings item may change.
import type { BotLevel } from '@/bot';

/** Komi (贴目 tiēmù) for the learner's 9×9 games; the engine default for 9×9 stays 7.5. */
export const GAME_KOMI_9 = 5.5;

/** Level 1 (入门 Easy) blunder on 9×9: misses a capture with half this (§6.1, AC 8 tuning). */
export const L1_BLUNDER_9 = 0.5;

export const BOT_LEVELS: readonly BotLevel[] = [1, 2, 3];
