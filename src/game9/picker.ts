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

/** 13×13 opens once any 9×9 level is beaten (M6b AC 2–3, §11 decision 6). */
export function isSize13Unlocked(bots9: BotProgress): boolean {
  return ([1, 2, 3] as const).some((level) => isBeaten(bots9, level));
}

/**
 * Unit 14's lesson: its result screen offers "Play 9×9". The Home card no longer waits for it
 * (open from the start since M6-settings AC 61).
 */
export const UNLOCK_LESSON = 'u14-end';
