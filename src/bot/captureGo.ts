// Capture Go 吃子棋 rules on top of the engine (spec §4 B, §7.2): the first side to capture `n`
// stones wins; at the move limit or after two passes, more captures wins and equal is a draw.
// Shared by the game screen's reducer, the lesson validator's smoke playouts and the tuning test.
import {
  createGame,
  pass,
  play,
  type BoardSize,
  type Color,
  type GameState,
  type Move,
  type Vertex,
} from '@/engine';

import { chooseMove } from './choose';
import { createRng, deriveSeed, type Rng } from './rng';
import type { BotLevel } from './types';

export interface CaptureGoRules {
  /** Captures needed to win. */
  n: number;
  /** The learner's colour (the other side is the bot). */
  player: Color;
  /** Plies (moves and passes) after which the game is decided on captures. */
  maxMoves: number;
}

export type CaptureGoStatus = 'playing' | 'won' | 'lost' | 'draw';

/** The result for the learner after any move (an overshoot counts). */
export function captureGoStatus(state: GameState, rules: CaptureGoRules): CaptureGoStatus {
  const bot: Color = rules.player === 'B' ? 'W' : 'B';
  const mine = state.captures[rules.player];
  const theirs = state.captures[bot];
  if (mine >= rules.n) return 'won';
  if (theirs >= rules.n) return 'lost';
  if (state.isOver || state.moves.length >= rules.maxMoves) {
    return mine > theirs ? 'won' : mine < theirs ? 'lost' : 'draw';
  }
  return 'playing';
}

/** Chooses a move for `state.toPlay`. */
export type Player = (state: GameState) => Move;

export interface PlayoutResult {
  status: Exclude<CaptureGoStatus, 'playing'>;
  state: GameState;
  plies: number;
}

/** Plays a whole game. Throws on an illegal move (a bug, never expected). */
export function playCaptureGo(
  start: GameState,
  rules: CaptureGoRules,
  learner: Player,
  bot: Player,
): PlayoutResult {
  let state = start;
  for (;;) {
    const status = captureGoStatus(state, rules);
    if (status !== 'playing') return { status, state, plies: state.moves.length };
    const mover = state.toPlay === rules.player ? learner : bot;
    const move = mover(state);
    if (move.color !== state.toPlay) throw new Error(`${move.color} moved out of turn`);
    const result = move.type === 'pass' ? pass(state) : play(state, move.point);
    if (!result.ok) throw new Error(`illegal move: ${result.reason}`);
    state = result.state;
  }
}

/** The bot's rng for one ply of a game: games replay exactly from their seed. */
export function botRng(seed: number, ply: number): Rng {
  return createRng(deriveSeed(seed, ply));
}

/** A play-bot game as plain data (the bot never imports lesson types). */
export interface CaptureGoConfig {
  size: BoardSize;
  setup: { B?: Vertex[]; W?: Vertex[] };
  first: Color;
  rules: CaptureGoRules;
  level: BotLevel;
  blunder: number;
}

/**
 * One deterministic game of a reference learner against the configured bot. The default learner
 * is "Sensible": bot level 1 with blunder 0 for the learner's colour (spec §7.2, AC 64).
 */
export function referencePlayout(
  config: CaptureGoConfig,
  seed: number,
  learner?: (state: GameState, rng: Rng) => Move,
): PlayoutResult {
  const start = createGame(config.size, { setup: config.setup, toPlay: config.first });
  const learnerSeed = deriveSeed(seed, 0x5bd1e995);
  const sensible = (state: GameState, rng: Rng) => chooseMove(state, { level: 1, rng }).move;
  const learnerMove = learner ?? sensible;
  return playCaptureGo(
    start,
    config.rules,
    (state) => learnerMove(state, botRng(learnerSeed, state.moves.length)),
    (state) =>
      chooseMove(state, {
        level: config.level,
        blunder: config.blunder,
        rng: botRng(seed, state.moves.length),
      }).move,
  );
}
