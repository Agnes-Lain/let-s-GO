// Level picker rules (spec docs/specs/M6-bot-levels.md AC 15, 34, 36, 37). Pure: reads progress.
import type { BotLevel } from '@/bot';
import type { BotProgress, ProgressFlags } from '@/store/progress';

/** Losses in a row at one level before the "Try Easy" tip (AC 37). */
export const LOSSES_BEFORE_TIP = 3;

/** Easy until the learner has won any game, then Normal (AC 15, 36). Nothing is locked. */
export function preselectedLevel(bots: BotProgress): BotLevel {
  const won = (['1', '2', '3'] as const).some((key) => (bots[key]?.wins ?? 0) > 0);
  return won ? 2 : 1;
}

export function isBeaten(bots: BotProgress, level: BotLevel): boolean {
  return (bots[String(level) as '1' | '2' | '3']?.wins ?? 0) > 0;
}

/** The gentle tip, once ever: three losses in a row at Normal or Challenge (AC 37). */
export function showEasierTip(bots: BotProgress, flags: ProgressFlags): boolean {
  if (flags.easierTipShown) return false;
  return (['2', '3'] as const).some((key) => (bots[key]?.lossStreak ?? 0) >= LOSSES_BEFORE_TIP);
}

/** The Home card unlocks with ≥ 1 star on Unit 14's lesson (AC 14). */
export const UNLOCK_LESSON = 'u14-end';
