// When the first-launch intro shows (docs/specs/M6-settings-onboarding-a11y.md AC 24–25). Pure.
import type { BotProgress, LessonProgressMap, ProgressFlags } from './progress';
import { REMOVED_LESSON_IDS } from './progress';

export interface OnboardingInput {
  flags: ProgressFlags;
  lessons: LessonProgressMap;
  bots: BotProgress;
  hydrated: boolean;
}

/**
 * True only for a fresh install: progress is read, the intro was never left, and there is no lesson
 * or bot record (an existing player counts as "seen" without writing anything). A leftover record of
 * a removed lesson (the old developer sample) is not progress.
 */
export function shouldShowOnboarding({ flags, lessons, bots, hydrated }: OnboardingInput): boolean {
  if (!hydrated || flags.onboardingSeen) return false;
  const hasLessons = Object.keys(lessons).some((id) => !REMOVED_LESSON_IDS.includes(id));
  return !hasLessons && Object.keys(bots).length === 0;
}
