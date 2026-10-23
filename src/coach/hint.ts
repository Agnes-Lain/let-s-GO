// The 提示 tíshì hint (spec docs/specs/M6-game-coaching.md §4.3): the level-2 scorer's best move
// and one reason the engine can prove. Deterministic: no randomness, no clock.
import { PASS_BELOW, scoreMoves, type BotLevel, type MoveKind } from '@/bot';
import { groupAt, play, type GameState, type Point } from '@/engine';

import type { CoachNote } from './facts';

/** Hints per game by level (AC 17–20, PO 2026-10-23): Easy and Normal unlimited (null), Challenge 3. */
export const HINTS_PER_GAME: Readonly<Record<BotLevel, number | null>> = { 1: null, 2: null, 3: 3 };

export type HintCategory = 'capture' | 'save' | 'atari' | 'liberties' | 'territory' | 'pass';

export interface Hint {
  /** null: nothing urgent (the best move would be a pass, AC 22). */
  point: Point | null;
  category: HintCategory;
  /** Stones captured (capture) or put in atari (atari). */
  count?: number;
}

/** A group of the mover with at most this many liberties is "weak" (AC 21 `liberties`). */
const WEAK_LIBERTIES = 2;

function neighbours(p: Point, size: number): Point[] {
  return [
    { x: p.x - 1, y: p.y },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y - 1 },
    { x: p.x, y: p.y + 1 },
  ].filter((q) => q.x >= 0 && q.y >= 0 && q.x < size && q.y < size);
}

/** The reason category of a legal move for `state.toPlay` with the scorer's kind (AC 21). */
export function hintCategory(
  state: GameState,
  point: Point,
  kind: MoveKind,
): { category: HintCategory; count?: number } {
  const result = play(state, point);
  if (!result.ok) return { category: 'territory' };
  const { facts } = result;
  if (kind === 'capture') return { category: 'capture', count: facts.captured.flat().length };
  if (kind === 'save') return { category: 'save' };
  if (kind === 'atari') {
    const count = facts.opponentAtari.reduce((n, g) => n + g.stones.length, 0);
    if (count > 0) return { category: 'atari', count };
  }
  const color = state.toPlay;
  const weakBefore = neighbours(point, state.board.size)
    .map((q) => groupAt(state.board, q))
    .filter((g) => g !== null && g.color === color && g.liberties.length <= WEAK_LIBERTIES)
    .map((g) => g?.liberties.length ?? 0);
  if (weakBefore.length > 0 && facts.playedGroup.liberties.length > Math.min(...weakBefore)) {
    return { category: 'liberties' };
  }
  return { category: 'territory' };
}

/** The hint for the player to move (AC 17, 21–23): the level-2 scorer's best move, or none. */
export function hintFor(state: GameState): Hint {
  const best = scoreMoves(state)[0];
  if (!best || best.score < PASS_BELOW) return { point: null, category: 'pass' };
  return { point: best.point, ...hintCategory(state, best.point, best.kind) };
}

/** The reason line of a hint (one sentence, no coordinates). */
export function hintNote(hint: Hint): CoachNote {
  const params = { count: hint.count ?? 0 };
  switch (hint.category) {
    case 'capture':
      return { key: 'coach.hint.capture', params };
    case 'save':
      return { key: 'coach.hint.save' };
    case 'atari':
      return { key: 'coach.hint.atari', params };
    case 'liberties':
      return { key: 'coach.hint.liberties' };
    case 'territory':
      return { key: 'coach.hint.territory' };
    case 'pass':
      return { key: 'coach.hint.pass' };
  }
}
