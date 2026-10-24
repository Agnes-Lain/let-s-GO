import { type GameState } from '@/engine';

import { maxPliesFor, opponentJustPassed, passAfterOpponentPass } from './board9';
import { level1 } from './heuristic';
import { playableMoves } from './level2';
import { level3Search } from './level3';
import type { BotChoice, BotLevel, BotOptions, Strategy } from './types';

function passFor(state: GameState): BotChoice {
  return { move: { type: 'pass', color: state.toPlay }, reason: 'pass' };
}

/**
 * The common start of levels 2 and 3 (spec M6 §4.2): pass at the ply cap, when no move is worth
 * playing (only own eyes or self-atari left, AC 12), or after an opponent pass when ahead (AC 10).
 * Returns null when the bot should choose a stone.
 */
function passCheck(state: GameState, opts: BotOptions, hasMoves: boolean): BotChoice | null {
  if (state.moves.length >= maxPliesFor(state.board.size) || !hasMoves) return passFor(state);
  if (opponentJustPassed(state) && passAfterOpponentPass(state, opts.rng)) return passFor(state);
  return null;
}

/** Level 2 — 普通 Normal (§6.2): the best-scored point; ties by one rng draw. */
export function level2(state: GameState, opts: BotOptions): BotChoice {
  const r = opts.rng();
  const moves = playableMoves(state);
  const passed = passCheck(state, opts, moves.length > 0);
  if (passed) return passed;
  const slip = opts.slip ?? 0;
  if (slip > 0) {
    // AC 39: a seeded slip to the 2nd or 3rd best point, never when a capture or save exists.
    const roll = opts.rng();
    const which = opts.rng();
    const urgent = moves.some((m) => m.kind === 'capture' || m.kind === 'save');
    const worse = moves.filter((m) => m.score < moves[0].score).slice(0, 2);
    if (roll < slip && !urgent && worse.length > 0) {
      const pick = worse[Math.min(worse.length - 1, Math.floor(which * worse.length))];
      return { move: { type: 'play', color: state.toPlay, point: pick.point }, reason: pick.kind };
    }
  }
  const top = moves.filter((m) => m.score === moves[0].score);
  const pick = top[Math.min(top.length - 1, Math.floor(r * top.length))];
  return { move: { type: 'play', color: state.toPlay, point: pick.point }, reason: pick.kind };
}

/** Level 3 — 挑战 Challenge (§6.3): flat Monte-Carlo over the best level-2 points. */
export function level3(state: GameState, opts: BotOptions): BotChoice {
  const seed = Math.floor(opts.rng() * 0x100000000);
  const passed = passCheck(state, opts, playableMoves(state).length > 0);
  if (passed) return passed;
  const { best } = level3Search(state, seed);
  if (!best) return passFor(state);
  return { move: { type: 'play', color: state.toPlay, point: best.point }, reason: best.kind };
}

/** Registered strategies (M6 AC 1: every level is registered, no fallback). */
const strategies: Record<BotLevel, Strategy> = { 1: level1, 2: level2, 3: level3 };

/**
 * The bot's move for `state.toPlay`: always legal or a pass. Capture Go (level 1 without
 * `boardN`) passes only when no legal point exists.
 */
export function chooseMove(state: GameState, opts: BotOptions): BotChoice {
  return strategies[opts.level](state, opts);
}
