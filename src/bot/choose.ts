import type { GameState } from '@/engine';

import { level1 } from './heuristic';
import type { BotChoice, BotLevel, BotOptions, Strategy } from './types';

/** Registered strategies. Levels 2 and 3 (M6) are not registered yet and fall back to level 1. */
const strategies: Partial<Record<BotLevel, Strategy>> = { 1: level1 };

/** The bot's move for `state.toPlay`: always legal; a pass only when no legal point exists. */
export function chooseMove(state: GameState, opts: BotOptions): BotChoice {
  const strategy = strategies[opts.level] ?? level1;
  return strategy(state, opts);
}
