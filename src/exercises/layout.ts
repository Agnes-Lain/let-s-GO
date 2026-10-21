import { useWindowDimensions } from 'react-native';

import { spacing } from '@/theme/tokens';

/** Boards never grow past this (tablets, wide web windows). */
export const MAX_BOARD_WIDTH = 480;

/** The square board fills the width between the 16 px gutters (328 px on a 360 px phone). */
export function boardWidthFor(windowWidth: number): number {
  return Math.max(0, Math.min(windowWidth - 2 * spacing.lg, MAX_BOARD_WIDTH));
}

export function useBoardWidth(): number {
  return boardWidthFor(useWindowDimensions().width);
}

/**
 * Practice screen budget at the default layout: top bar 52, prompt 72, feedback 72, button 48,
 * bottom padding 16 and four 8 px gaps.
 */
export const PRACTICE_FIXED_HEIGHT = 52 + 72 + 72 + 48 + 16 + 4 * 8;
/** Two rows of number chips (44 each) with an 8 px gap, plus the gap above them. */
export const COUNT_CHIPS_HEIGHT = 44 + 8 + 44 + 8;
export const OPTION_HEIGHT = 48;
export const OPTION_GAP = 8;
export const CHOICE_BOARD = { min: 220, max: 240 } as const;

/** Mark screens add the status row "Marked: n" (36) and its gap (M5-territory-counting §5.2). */
export const MARK_STATUS_ROW = 36 + 8;
/**
 * Count-entry screens (M5-territory-counting §5.2): the entry row and two key rows (44 each, 8 px
 * gaps) replace the bottom button (48), so they need 3 × 44 + 3 × 8 − 48 more than the default.
 */
export const COUNT_ENTRY_HEIGHT = 3 * 44 + 3 * 8 - 48;

export type PracticeKind = 'tap-point' | 'play-move' | 'choice' | 'count' | 'count-entry' | 'mark';

/**
 * Board width on the practice screen (spec §6.3–6.4): the M2 rule (window width − 32, ≤ 480),
 * limited by the free height so nothing scrolls; choice boards shrink to 220–240 px.
 */
export function practiceBoardWidth(
  kind: PracticeKind,
  window: { width: number; height: number },
  options = 3,
): number {
  const base = boardWidthFor(window.width);
  const free = window.height - PRACTICE_FIXED_HEIGHT;
  switch (kind) {
    case 'count':
      return Math.max(0, Math.min(base, free - COUNT_CHIPS_HEIGHT));
    case 'count-entry':
      return Math.max(0, Math.min(base, free - COUNT_ENTRY_HEIGHT));
    case 'mark':
      return Math.max(0, Math.min(base, free - MARK_STATUS_ROW));
    case 'choice': {
      const optionsHeight = options * OPTION_HEIGHT + (options - 1) * OPTION_GAP + OPTION_GAP;
      const fit = Math.min(CHOICE_BOARD.max, free - optionsHeight);
      return Math.min(base, Math.max(CHOICE_BOARD.min, fit));
    }
    default:
      return Math.max(0, Math.min(base, free));
  }
}

/**
 * Capture Go screen budget (M4 item 2 §5.2) in its tallest state, the end card: top bar 52,
 * score 56 + 8, turn-pill slot 36 + 8, gap 8, end card 132, gap 8, button 48, bottom padding 16.
 */
export const GAME_FIXED_HEIGHT = 52 + 64 + 44 + 8 + 132 + 8 + 48 + 16;

/** The Capture Go goal card above the score row (M5-life-death §5.6, AC 42). */
export const GAME_GOAL_HEIGHT = 48;

/**
 * Capture Go budget while playing (M5 §5.6): top bar 52, goal card 48 + 8, score 56 + 8, turn-pill
 * slot 36 + 8, gap 8, feedback 72, gap 8, Restart 44, bottom padding 16. The end card replaces the
 * goal card, so the end state keeps GAME_FIXED_HEIGHT.
 */
export const GAME_PLAYING_FIXED_HEIGHT = 52 + GAME_GOAL_HEIGHT + 8 + 64 + 44 + 8 + 72 + 8 + 44 + 16;

/** Board width on the game screen: the M2 rule, limited by the free height (328 px at 360×740). */
export function gameBoardWidth(window: { width: number; height: number }): number {
  const fixed = Math.max(GAME_FIXED_HEIGHT, GAME_PLAYING_FIXED_HEIGHT);
  return Math.max(0, Math.min(boardWidthFor(window.width), window.height - fixed));
}
