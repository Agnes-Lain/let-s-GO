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
   * A whole-board game (9×9 in M6, 13×13 in M6b) rather than Capture Go: level 1 never fills its
   * own eyes, passes when nothing useful is left or after an opponent pass, and opens away from the
   * edge. Levels 2 and 3 always play this way. Default false, so recorded Capture Go games do not
   * change.
   */
  boardN?: boolean;
  /** The M6 name of `boardN` (same behaviour); kept so existing callers and tests stay valid. */
  board9?: boolean;
  /**
   * Level 1 with `boardN` only (M6-beginner-friendly §4.4): the chance to not save an own group in
   * atari (skip rule 2) and to not put an opponent group in atari (skip rule 3). Default 0.
   */
  skipSave?: number;
  skipAtari?: number;
  /**
   * Level 2 only (M6-beginner-friendly AC 39): the chance to play the 2nd or 3rd best point when
   * no capture or save exists. Default 0.
   */
  slip?: number;
  /**
   * Level 3 only, for the tuning script (M6b-2 AC 10): playouts per candidate and softmax
   * temperature. Default: the board size's constants (`mcBudget`, `mcTemperature`).
   */
  playoutsPerCandidate?: number;
  temperature?: number;
}

export interface BotChoice {
  move: Move;
  reason: BotReason;
}

export type Strategy = (state: GameState, opts: BotOptions) => BotChoice;
