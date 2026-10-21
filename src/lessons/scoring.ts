// Territory and counting facts for lessons (spec docs/specs/M5-territory-counting.md §5.6).
// Pure: every number comes from the engine's Chinese area scoring `score()`.
import {
  groupAt,
  parseVertex,
  score,
  toVertex,
  type Board,
  type Color,
  type Vertex,
} from '@/engine';

import type { ChoiceProof, MarkExercise, ProofOutcome, ScoreAnswer } from './schema';

/** Komi used when only stones and territory matter (it never enters a count). */
const NO_KOMI_NEEDED = 0.5;

export interface SideFacts {
  stones: number;
  territory: number;
  /** stones + territory (komi not included). */
  area: number;
  /** The side's territory points, sorted by column then row. */
  points: Vertex[];
}

export interface ScoreFacts {
  B: SideFacts;
  W: SideFacts;
  /** Neutral points 单官 (empty points that touch both colours, or none). */
  dame: Vertex[];
  /** Every stone of the dead groups, sorted. */
  dead: Vertex[];
}

/** The other colour. */
export const otherColor = (c: Color): Color => (c === 'B' ? 'W' : 'B');

/** Stones, territory and areas of both sides after removing the `dead` groups. */
export function scoreFacts(board: Board, dead: readonly Vertex[] = []): ScoreFacts {
  const result = score(board, { komi: NO_KOMI_NEEDED, deadStones: dead });
  const { size } = board;
  const territory = (color: Color): Vertex[] => {
    const out: { x: number; y: number }[] = [];
    result.ownership.forEach((owner, index) => {
      const x = index % size;
      const y = Math.floor(index / size);
      const deadHere = result.deadStones.some((p) => p.x === x && p.y === y);
      if (owner === color && (board.cells[index] === null || deadHere)) out.push({ x, y });
    });
    return out.sort((a, b) => a.x - b.x || a.y - b.y).map((p) => toVertex(p, size));
  };
  const side = (color: Color, facts: typeof result.black): SideFacts => ({
    stones: facts.stones,
    territory: facts.territory,
    area: facts.stones + facts.territory,
    points: territory(color),
  });
  return {
    B: side('B', result.black),
    W: side('W', result.white),
    dame: result.dame.map((p) => toVertex(p, size)),
    dead: result.deadStones.map((p) => toVertex(p, size)),
  };
}

/** The number a `score` count asks for. */
export function scoreValue(board: Board, answer: ScoreAnswer): number {
  return scoreFacts(board, answer.dead)[answer.side][answer.of];
}

/** Owner of one point: the stone on it, or the only colour around its empty region. */
export function ownerOf(board: Board, at: Vertex): ProofOutcome {
  const { ownership } = score(board, { komi: NO_KOMI_NEEDED });
  const group = groupAt(board, at);
  if (group) return group.color;
  const p = parseVertex(at, board.size);
  return ownership[p.y * board.size + p.x] ?? 'none';
}

/** Winner with komi; 'none' on a draw (validator CHOICE_PROVE_DRAW). */
export function winnerOf(board: Board, komi: number, dead: readonly Vertex[] = []): ProofOutcome {
  return score(board, { komi, deadStones: dead }).winner ?? 'none';
}

/** The engine's outcome for a `prove` choice. */
export function proofOutcome(board: Board, prove: ChoiceProof): ProofOutcome {
  return prove.kind === 'owner'
    ? ownerOf(board, prove.at)
    : winnerOf(board, prove.komi, prove.dead ?? []);
}

/** Every stone of the groups on `marked` (each group once), sorted by column then row. */
export function groupStones(board: Board, marked: readonly Vertex[]): Vertex[] {
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (const at of marked) {
    const group = groupAt(board, at);
    if (!group) continue;
    for (const p of group.stones) {
      const v = toVertex(p, board.size);
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(p);
    }
  }
  return out.sort((a, b) => a.x - b.x || a.y - b.y).map((p) => toVertex(p, board.size));
}

/** The answer of a `mark` exercise on its board: territory points of `side`, or the dead stones. */
export function markAnswer(board: Board, exercise: Pick<MarkExercise, 'mark' | 'side' | 'dead'>) {
  if (exercise.mark === 'dead') return groupStones(board, exercise.dead ?? []);
  return scoreFacts(board)[exercise.side ?? 'B'].points;
}
