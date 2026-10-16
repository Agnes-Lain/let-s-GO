// Engine facts → feedback sentences (spec §7.2). Every wrong answer states a fact about the
// position, never just "wrong".
import type { IllegalReason, MoveFacts } from '@/engine';
import { capturedCount, type Goal } from '@/lessons';

import type { FeedbackLine } from './attempts';

/** Why a legal move did not meet the goal (+ a self-atari warning as a second line). */
export function playMoveFeedback(goal: Goal, facts: MoveFacts): FeedbackLine[] {
  const lines: FeedbackLine[] = [];
  switch (goal.kind) {
    case 'capture': {
      const n = capturedCount(facts);
      lines.push(
        n > 0 && n < (goal.min ?? 1)
          ? { key: 'fb.pm.captureTooFew', params: { n } }
          : { key: 'fb.pm.noCapture' },
      );
      break;
    }
    case 'atari':
      lines.push({ key: 'fb.pm.noAtari' });
      break;
    case 'connect':
      lines.push({ key: 'fb.pm.notConnected' });
      break;
    case 'save':
      lines.push({ key: 'fb.pm.stillAtari' });
      break;
    case 'point':
      lines.push({ key: 'fb.pm.wrongPoint' });
      break;
  }
  if (facts.selfAtari) lines.push({ key: 'fb.pm.selfAtari' });
  return lines;
}

const ILLEGAL_KEYS: Record<IllegalReason, string> = {
  occupied: 'engine.illegal.occupied',
  suicide: 'engine.illegal.suicide',
  ko: 'engine.illegal.ko',
  'game-over': 'engine.illegal.gameOver',
  'off-board': 'engine.illegal.occupied',
};

/** The engine's reason for an illegal touch (not an attempt). */
export function illegalFeedback(reason: IllegalReason): FeedbackLine[] {
  return [{ key: ILLEGAL_KEYS[reason] }];
}

/** Tap-all check: how many were found, and whether wrong points were removed. */
export function tapAllFeedback(found: number, total: number, extra: number): FeedbackLine[] {
  const lines: FeedbackLine[] = [{ key: 'fb.tapAll.partial', params: { found, total } }];
  if (extra > 0) lines.push({ key: 'fb.tapAll.extra' });
  return lines;
}
