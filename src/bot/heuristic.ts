// Bot level 1: rules of thumb in priority order (spec docs/specs/M4-bot-capture-go.md §6.2).
// Capture > save > atari > (blunder) > pressure. Pure: reads the engine, never changes a state.
import { legalMoves, type GameState, type Point } from '@/engine';

import { analyzeMoves, exposedStones, type MoveAnalysis } from './analysis';
import type { BotChoice, BotOptions } from './types';

export { exposedStones };

/** Picks one item with r ∈ [0, 1); the list must not be empty. */
function pick<T>(items: readonly T[], r: number): T {
  return items[Math.min(items.length - 1, Math.floor(r * items.length))];
}

/** All items with the best key (highest first). */
function best<T>(items: readonly T[], key: (item: T) => number): T[] {
  const top = Math.max(...items.map(key));
  return items.filter((item) => key(item) === top);
}

function isFirstLine(p: Point, size: number): boolean {
  return p.x === 0 || p.y === 0 || p.x === size - 1 || p.y === size - 1;
}

/**
 * Level 1. Draws exactly three numbers first (r1, r2, r3), so a change in the number of draws is
 * a conscious break of recorded games (AC 4).
 */
export function level1(state: GameState, opts: BotOptions): BotChoice {
  const r1 = opts.rng();
  const r2 = opts.rng();
  const r3 = opts.rng();
  const blunder = opts.blunder ?? 0;
  const color = state.toPlay;

  const points = legalMoves(state);
  if (points.length === 0) return { move: { type: 'pass', color }, reason: 'pass' };

  const exposedBefore = exposedStones(state.board, color);
  const candidates = analyzeMoves(state.board, color, points);
  const choice = (c: MoveAnalysis, reason: BotChoice['reason']): BotChoice => ({
    move: { type: 'play', color, point: c.point },
    reason,
  });

  // 1. Capture the most stones (missed with probability blunder / 2).
  if (!(r1 < blunder / 2)) {
    const captures = candidates.filter((c) => c.captured > 0);
    if (captures.length > 0)
      return choice(
        pick(
          best(captures, (c) => c.captured),
          r3,
        ),
        'capture',
      );
  }

  if (r2 < blunder) {
    // 4. Blunder: any legal move, even a self-atari (skips rules 2 and 3).
    return choice(pick(candidates, r3), 'blunder');
  }

  // 2. Save own stones in atari: fewest stones left in atari, then most liberties.
  if (exposedBefore > 0) {
    const saves = candidates.filter((c) => c.exposed < exposedBefore && !c.selfAtari);
    if (saves.length > 0) {
      const fewest = best(saves, (c) => -c.exposed);
      return choice(
        pick(
          best(fewest, (c) => c.liberties),
          r3,
        ),
        'save',
      );
    }
  }

  // 3. Put the largest opponent group in atari, without weakening own stones.
  const ataris = candidates.filter(
    (c) => c.opponentAtari.length > 0 && !c.selfAtari && c.exposed <= exposedBefore,
  );
  if (ataris.length > 0) {
    return choice(
      pick(
        best(ataris, (c) => Math.max(...c.opponentAtari)),
        r3,
      ),
      'atari',
    );
  }

  // 5. Pressure: touch opponent groups, keep liberties, avoid the first line.
  let pool = candidates.filter((c) => !c.selfAtari && c.exposed <= exposedBefore);
  if (pool.length === 0) pool = candidates.filter((c) => !c.selfAtari);
  if (pool.length === 0) pool = candidates;
  const size = state.board.size;
  const scored = pool.map((c) => {
    const edge = isFirstLine(c.point, size) && c.touched === 0 ? 2 : 0;
    return { c, score: 2 * c.touched + Math.min(c.liberties, 4) - edge };
  });
  const scores = [...new Set(scored.map((s) => s.score))].sort((a, b) => b - a).slice(0, 3);
  const threshold = scores[scores.length - 1];
  const picked = pick(
    scored.filter((s) => s.score >= threshold),
    r3,
  ).c;
  return choice(picked, picked.touched > 0 ? 'pressure' : 'random');
}
