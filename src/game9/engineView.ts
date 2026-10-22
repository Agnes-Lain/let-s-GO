// The only place in src/game9/ui that asks the engine about a move (like
// src/exercises/engineAdapter.ts): the board stays rule-free.
import { checkMove, type CheckResult, type GameState, type Point } from '@/engine';

export function checkGameMove(state: GameState, point: Point): CheckResult {
  return checkMove(state, point);
}
