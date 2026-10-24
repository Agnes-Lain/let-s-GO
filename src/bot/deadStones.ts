// Dead-stone judgement after a 9×9 or 13×13 game (spec docs/specs/M6-bot-levels.md §6.4, AC 26–29).
// Per group: a forced-capture proof when it has ≤ 2 liberties, else random playouts from the
// final position. Every opinion carries engine facts (liberties, eyes), never prose.
import {
  groupAt,
  toVertex,
  type BoardSize,
  type Color,
  type GameState,
  type Group,
  type Vertex,
} from '@/engine';

import { isOwnEye } from './eyes';
import { FORCED_CAPTURE_MAX_NODES, forcedCapture } from './forcedCapture';
import { PlayoutBoard } from './playout';
import { createRng, deriveSeed, type Rng } from './rng';

/** Playouts from the final position (§6.4 step 2). */
export const DEAD_PLAYOUTS = 200;
/**
 * Plies per playout (spec: 60). 60 random plies leave lone invaders undecided (~0.55 captured),
 * so the playouts run to the end of the game (two passes) with this cap (§12b).
 */
export const DEAD_PLAYOUT_PLIES = 150;

/** Plies per dead-stone playout for a board size (M6b AC 36): twice as many on 13×13. */
export function deadPlayoutPlies(size: number): number {
  return size >= 13 ? 2 * DEAD_PLAYOUT_PLIES : DEAD_PLAYOUT_PLIES;
}
/** A group is dead (or alive) by playouts when this share of playouts agree. */
export const DEAD_RATE = 0.8;
/** Attacker moves allowed in the forced-capture proof of a group with ≤ 2 liberties. */
const PROOF_MOVES = 4;

export type GroupStatus = 'proved-dead' | 'dead' | 'alive' | 'undecided';

export interface GroupJudgement {
  color: Color;
  /** All stones, sorted by column then row. */
  stones: Vertex[];
  /** The group's first stone (named in messages). */
  at: Vertex;
  status: GroupStatus;
  /** Share of playouts in which the group was captured. */
  deadRate: number;
  liberties: number;
  /** Own single-point eyes next to the group. */
  eyes: number;
}

export type DeadDispute =
  /** Proven-dead groups the learner did not mark: the bot proposes them (Accept / Play on). */
  | { kind: 'propose'; groups: GroupJudgement[] }
  /** A marked group that is alive by playouts and cannot be captured by force. */
  | { kind: 'alive'; group: GroupJudgement }
  /** A playout-only opinion that differs from the marks: the learner's marks stand. */
  | { kind: 'unsure'; group: GroupJudgement };

export interface DeadMarksJudgement {
  /** No dispute at all: the marks equal the bot's proposal. */
  agreed: boolean;
  disputes: DeadDispute[];
}

function other(color: Color): Color {
  return color === 'B' ? 'W' : 'B';
}

/** The state with the game reopened (after two passes `play` would answer 'game-over'). */
function reopened(state: GameState): GameState {
  return { ...state, isOver: false, consecutivePasses: 0, koPoint: null };
}

function groupsOf(state: GameState): Group[] {
  const { board } = state;
  const size = board.size;
  const seen = new Set<number>();
  const groups: Group[] = [];
  board.cells.forEach((stone, index) => {
    if (stone === null || seen.has(index)) return;
    const group = groupAt(board, { x: index % size, y: Math.floor(index / size) }) as Group;
    for (const p of group.stones) seen.add(p.y * size + p.x);
    groups.push(group);
  });
  return groups;
}

/** Share of playouts in which each group's first stone was captured. */
function deadRates(state: GameState, groups: Group[], rng: Rng): number[] {
  const size = state.board.size;
  const base = PlayoutBoard.fromState(reopened(state));
  base.passes = 0;
  const work = new PlayoutBoard(size);
  const captured = new Array<number>(groups.length).fill(0);
  const seed = Math.floor(rng() * 0x100000000);
  for (let i = 0; i < DEAD_PLAYOUTS; i++) {
    work.copyFrom(base);
    work.plies = 0;
    // Half the playouts start with each colour, so the side to move does not decide.
    if (i % 2 === 1) work.toPlay = work.toPlay === 1 ? 2 : 1;
    work.playout(createRng(deriveSeed(seed, i)), deadPlayoutPlies(size));
    groups.forEach((group, g) => {
      const first = group.stones[0];
      const stone = work.cells[first.y * size + first.x];
      if (stone !== (group.color === 'B' ? 1 : 2)) captured[g]++;
    });
  }
  return captured.map((n) => n / DEAD_PLAYOUTS);
}

function eyesOf(state: GameState, group: Group): number {
  return group.liberties.filter((p) => isOwnEye(state.board, p, group.color)).length;
}

/** Proof (§6.4 step 1): the opponent, moving first, captures the group against every defence. */
function provedDead(state: GameState, group: Group): boolean {
  if (group.liberties.length > 2) return false;
  return forcedCapture(reopened(state), {
    attacker: other(group.color),
    target: group.stones[0],
    maxMoves: PROOF_MOVES,
    maxNodes: FORCED_CAPTURE_MAX_NODES,
  }).forced;
}

/** The bot's opinion on every group of the final position (deterministic for one rng). */
export function judgeGroups(state: GameState, rng: Rng): GroupJudgement[] {
  const size = state.board.size as BoardSize;
  const groups = groupsOf(state);
  const rates = deadRates(state, groups, rng);
  return groups.map((group, g) => {
    const deadRate = rates[g];
    const status: GroupStatus = provedDead(state, group)
      ? 'proved-dead'
      : deadRate >= DEAD_RATE
        ? 'dead'
        : deadRate <= 1 - DEAD_RATE
          ? 'alive'
          : 'undecided';
    const stones = group.stones.map((p) => toVertex(p, size));
    return {
      color: group.color,
      stones,
      at: stones[0],
      status,
      deadRate,
      liberties: group.liberties.length,
      eyes: eyesOf(state, group),
    };
  });
}

function isDead(judgement: GroupJudgement): boolean {
  return judgement.status === 'proved-dead' || judgement.status === 'dead';
}

/** The stones the bot thinks are dead (whole groups), sorted like the engine. */
export function deadStonesOf(judgements: readonly GroupJudgement[]): Vertex[] {
  return judgements.filter(isDead).flatMap((j) => j.stones);
}

/** `proposeDead(state, rng)` (§6.4): the bot's dead-stone proposal. */
export function proposeDead(state: GameState, rng: Rng): Vertex[] {
  return deadStonesOf(judgeGroups(state, rng));
}

/**
 * Compares the learner's dead marks with the bot's opinion (§6.4 step 3, AC 26–29). A group
 * counts as marked when any of its stones is marked.
 */
export function judgeDeadMarks(
  judgements: readonly GroupJudgement[],
  marks: readonly Vertex[],
): DeadMarksJudgement {
  const marked = new Set(marks);
  const disputes: DeadDispute[] = [];
  const proposals: GroupJudgement[] = [];
  for (const group of judgements) {
    const isMarked = group.stones.some((v) => marked.has(v));
    if (isMarked) {
      if (group.status === 'alive') disputes.push({ kind: 'alive', group });
      else if (group.status === 'undecided') disputes.push({ kind: 'unsure', group });
    } else if (group.status === 'proved-dead') {
      proposals.push(group);
    } else if (group.status === 'dead') {
      disputes.push({ kind: 'unsure', group });
    }
  }
  if (proposals.length > 0) disputes.unshift({ kind: 'propose', groups: proposals });
  return { agreed: disputes.length === 0, disputes };
}
