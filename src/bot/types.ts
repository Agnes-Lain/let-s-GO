import type { GameState, Move } from '@/engine';

import type { Rng } from './rng';

/** 1 = 入门 Easy (rules of thumb), 2 = 普通 Normal (scored rules), 3 = 挑战 Challenge (Monte-Carlo). */
export type BotLevel = 1 | 2 | 3;
export type BotReason = 'capture' | 'save' | 'atari' | 'pressure' | 'random' | 'blunder' | 'pass';

export interface BotOptions {
  level: BotLevel;
  rng: Rng;
  /** 0..1, default 0: the chance to skip a rule of thumb (capture: blunder / 2). */
  blunder?: number;
  /**
   * A whole 9×9 game (M6) rather than Capture Go: level 1 never fills its own eyes, passes when
   * nothing useful is left or after an opponent pass, and opens away from the edge. Levels 2 and 3
   * always play this way. Default false, so recorded Capture Go games do not change.
   */
  board9?: boolean;
}

export interface BotChoice {
  move: Move;
  reason: BotReason;
}

export type Strategy = (state: GameState, opts: BotOptions) => BotChoice;
