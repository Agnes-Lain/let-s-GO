// Bot level 3 — 挑战 Challenge (spec docs/specs/M6-bot-levels.md §6.3): flat Monte-Carlo. The
// best level-2 points are candidates; each gets the same number of random games ("playouts") on
// the mutable playout board, and the candidate that wins most often is played. The budget is a
// count of playouts, never a time (AC 6), so a move replays exactly from its seed.
import type { Color, GameState, Point } from '@/engine';

import { playableMoves, type ScoredMove } from './level2';
import { PlayoutBoard } from './playout';
import { createRng, deriveSeed, type Rng } from './rng';

/** Candidate points per move (AC 6). */
export const MC_CANDIDATES = 12;
/** Playouts per candidate. */
export const MC_PLAYOUTS_PER_CANDIDATE = 100;
/** Total playouts per move with a full candidate list (AC 6, PO-visible). */
export const MC_PLAYOUTS = MC_CANDIDATES * MC_PLAYOUTS_PER_CANDIDATE;
/** Plies per playout after the candidate move. */
export const MC_MAX_PLIES = 110;
/** Value per point of mean margin (breaks ties toward bigger wins). */
export const MC_MARGIN_WEIGHT = 0.002;
/**
 * Value per point of the level-2 score (a prior, §12b): 100 random games cannot see that saving
 * or capturing two stones matters, so the rule of thumb tips close calls.
 */
export const MC_PRIOR_WEIGHT = 0.01;
/**
 * Softmax temperature of the final pick (PO 2026-10-21, §12b): the bot plays candidate i with
 * probability ∝ exp((value_i − best) / MC_TEMPERATURE), drawn from the move's seed. Clearly
 * better moves still win most draws (it "reads ahead"); near-equal ones are mixed, so Challenge
 * is beatable. 0 = always the best value.
 */
export const MC_TEMPERATURE = 0.21;

export interface CandidateValue {
  point: Point;
  /** Level-2 score. */
  prior: number;
  wins: number;
  playouts: number;
  /** Mean margin of the playouts from the bot's side (+ = bot ahead). */
  meanMargin: number;
  value: number;
}

export interface Level3Search {
  candidates: CandidateValue[];
  /** Playouts run for this move. */
  playouts: number;
  /** The chosen candidate (null when there is none: the bot passes). */
  best: (CandidateValue & { kind: ScoredMove['kind'] }) | null;
}

/**
 * The candidates: when a safe capture or a save exists, only those (AC 3–4: level 3 always
 * captures and saves, §12b); otherwise the best-scored points, up to MC_CANDIDATES.
 */
export function candidatesFor(moves: readonly ScoredMove[]): ScoredMove[] {
  const urgent = moves.filter((m) => m.kind === 'capture' || m.kind === 'save');
  return (urgent.length > 0 ? urgent : moves).slice(0, MC_CANDIDATES);
}

/** Runs the Monte-Carlo search for `state.toPlay` with a base seed. Pure and deterministic. */
export function level3Search(state: GameState, seed: number): Level3Search {
  const bot: Color = state.toPlay;
  const moves = candidatesFor(playableMoves(state));
  const size = state.board.size;
  const base = PlayoutBoard.fromState(state);
  const work = new PlayoutBoard(size);
  const plySeed = deriveSeed(seed, state.moves.length);
  let playouts = 0;
  const candidates: CandidateValue[] = moves.map((move, c) => {
    const candidateSeed = deriveSeed(plySeed, c);
    let wins = 0;
    let margin = 0;
    for (let i = 0; i < MC_PLAYOUTS_PER_CANDIDATE; i++) {
      work.copyFrom(base);
      work.play(move.point.y * size + move.point.x);
      work.plies = 0;
      work.playout(createRng(deriveSeed(candidateSeed, i)), MC_MAX_PLIES);
      const blackAhead = work.areaDifference(state.komi);
      const ours = bot === 'B' ? blackAhead : -blackAhead;
      if (ours > 0) wins++;
      margin += ours;
      playouts++;
    }
    const meanMargin = margin / MC_PLAYOUTS_PER_CANDIDATE;
    return {
      point: move.point,
      prior: move.score,
      wins,
      playouts: MC_PLAYOUTS_PER_CANDIDATE,
      meanMargin,
      value:
        wins / MC_PLAYOUTS_PER_CANDIDATE +
        MC_MARGIN_WEIGHT * meanMargin +
        MC_PRIOR_WEIGHT * move.score,
    };
  });
  const best = softmaxPick(candidates, createRng(deriveSeed(plySeed, 0x5eed)));
  return {
    candidates,
    playouts,
    best: best < 0 ? null : { ...candidates[best], kind: moves[best].kind },
  };
}

/** Index of the chosen candidate (−1 when none): a seeded softmax over the values (§12b). */
export function softmaxPick(candidates: readonly CandidateValue[], rng: Rng): number {
  if (candidates.length === 0) return -1;
  const top = Math.max(...candidates.map((c) => c.value));
  if (MC_TEMPERATURE <= 0) return candidates.findIndex((c) => c.value === top);
  const weights = candidates.map((c) => Math.exp((c.value - top) / MC_TEMPERATURE));
  let r = rng() * weights.reduce((n, w) => n + w, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
