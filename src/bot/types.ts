import type { GameState, Move } from '@/engine';

import type { Rng } from './rng';

/** Levels 2 and 3 arrive in M6; v1 plays them as level 1. */
export type BotLevel = 1 | 2 | 3;
export type BotReason = 'capture' | 'save' | 'atari' | 'pressure' | 'random' | 'blunder' | 'pass';

export interface BotOptions {
  level: BotLevel;
  rng: Rng;
  /** 0..1, default 0: the chance to skip a rule of thumb (capture: blunder / 2). */
  blunder?: number;
}

export interface BotChoice {
  move: Move;
  reason: BotReason;
}

export type Strategy = (state: GameState, opts: BotOptions) => BotChoice;
