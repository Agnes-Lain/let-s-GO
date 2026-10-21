// When a 9×9 bot passes (spec docs/specs/M6-bot-levels.md §4.2, §6.5): after the opponent passed,
// levels 2–3 pass when they are ahead on the count (after their own dead-stone proposal), else
// play on at most MAX_PLAY_ON times in a row; every level passes from ply MAX_PLIES_9 on.
import { score, type GameState } from '@/engine';

import { proposeDead } from './deadStones';
import type { Rng } from './rng';

/** Hard stop (AC 9): from this ply on, the bot passes every turn. */
export const MAX_PLIES_9 = 200;
/** "Play on" answers in a row after an opponent pass before the bot passes anyway (AC 10). */
export const MAX_PLAY_ON = 3;

/** The opponent's last action was a pass. */
export function opponentJustPassed(state: GameState): boolean {
  const last = state.moves[state.moves.length - 1];
  return last !== undefined && last.type === 'pass' && last.color !== state.toPlay;
}

/**
 * How many times in a row, before the opponent's current pass, the bot answered an opponent pass
 * with a stone: the move list ends with (pass, play) × n, then the current pass.
 */
export function playOnStreak(state: GameState): number {
  const moves = state.moves;
  const bot = state.toPlay;
  let n = 0;
  for (let i = moves.length - 2; i >= 1; i -= 2) {
    const reply = moves[i];
    const before = moves[i - 1];
    if (reply.type === 'play' && reply.color === bot && before.type === 'pass') n++;
    else break;
  }
  return n;
}

/** The bot (to move) wins the count after removing its own dead-stone proposal. */
export function botIsAhead(state: GameState, rng: Rng): boolean {
  const deadStones = proposeDead(state, rng);
  return score(state.board, { komi: state.komi, deadStones }).winner === state.toPlay;
}

/** AC 10: after an opponent pass, should level 2 / 3 pass too? */
export function passAfterOpponentPass(state: GameState, rng: Rng): boolean {
  return playOnStreak(state) >= MAX_PLAY_ON || botIsAhead(state, rng);
}
