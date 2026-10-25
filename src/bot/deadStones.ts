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
/**
 * 13×13 invaders (M6b-2 AC 17, 19, 22): random playouts let a lone stone live in about half of the
 * games inside a 60-point area, so on 13×13 and bigger a small group is also dead when it sits in
 * an area the opponent encloses (see `enclosedInvaders`). At most this many own stones in the area…
 */
export const INVADER_MAX_STONES = 6;
/** …and the area (empty points and own stones) is at most half the board. */
export function invaderAreaMax(size: number): number {
  return Math.floor((size * size) / 2);
}

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

/**
 * 13×13 and bigger (M6b-2 §4.5): the groups that are small invaders in an enclosed area. From the
 * group, flood over empty points and own stones: the area is enclosed when it touches only
 * opponent stones, every opponent group on its border is alive by playouts (so a seki, whose
 * opponent group is undecided, never counts), it holds at most INVADER_MAX_STONES own stones and
 * no own eye, and it is at most half the board (else it is the group's own area, not the
 * opponent's). Two passes ended the game, so the opponent answers every move there.
 */
function enclosedInvaders(state: GameState, groups: Group[], rates: number[]): boolean[] {
  const { board } = state;
  const { size, cells } = board;
  const groupOf = new Int32Array(cells.length).fill(-1);
  groups.forEach((group, g) => {
    for (const p of group.stones) groupOf[p.y * size + p.x] = g;
  });
  const result = groups.map(() => false);
  if (size < 13) return result;
  const done = new Uint8Array(cells.length);
  groups.forEach((group, g) => {
    const first = group.stones[0];
    if (result[g] || done[first.y * size + first.x]) return;
    const color = group.color;
    const area = [first.y * size + first.x];
    const inArea = new Uint8Array(cells.length);
    inArea[area[0]] = 1;
    const ownGroups = new Set<number>();
    let ownStones = 0;
    let enclosed = true;
    for (let i = 0; i < area.length; i++) {
      const c = area[i];
      if (cells[c] === color) {
        ownStones++;
        ownGroups.add(groupOf[c]);
        done[c] = 1;
      } else if (isOwnEye(board, { x: c % size, y: Math.floor(c / size) }, color)) {
        enclosed = false;
      }
      const x = c % size;
      for (const n of [x > 0 ? c - 1 : -1, x < size - 1 ? c + 1 : -1, c - size, c + size]) {
        if (n < 0 || n >= cells.length || inArea[n]) continue;
        const stone = cells[n];
        if (stone === null || stone === color) {
          inArea[n] = 1;
          area.push(n);
        } else if (rates[groupOf[n]] > 1 - DEAD_RATE) {
          enclosed = false;
        }
      }
    }
    if (!enclosed || ownStones > INVADER_MAX_STONES || area.length > invaderAreaMax(size)) return;
    for (const own of ownGroups) result[own] = true;
  });
  return result;
}

/**
 * Groups that are alive for sure (M6b-2 AC 21, a Benson-style check with one-point eyes): an
 * "eye" is an empty point whose neighbours are all stones of the remaining own groups. Groups
 * touching fewer than two eyes are dropped until nothing changes. Every remaining group has two
 * or more eye liberties, so the opponent can never play on an eye (suicide, no capture): they
 * cannot be captured, even when two groups share their eyes (random playouts may fill them).
 * 13×13 and bigger only, so recorded 9×9 counts stay the same (spec M6b-2 AC 5, §12.5).
 */
function sureAlive(state: GameState, groups: Group[]): boolean[] {
  const { size, cells } = state.board;
  const groupOf = new Int32Array(cells.length).fill(-1);
  groups.forEach((group, g) => {
    for (const p of group.stones) groupOf[p.y * size + p.x] = g;
  });
  const neighbours = (c: number) => {
    const x = c % size;
    return [x > 0 ? c - 1 : -1, x < size - 1 ? c + 1 : -1, c - size, c + size].filter(
      (n) => n >= 0 && n < cells.length,
    );
  };
  const alive = groups.map(() => size >= 13);
  for (let changed = size >= 13; changed;) {
    changed = false;
    const eyes = groups.map(() => 0);
    for (let c = 0; c < cells.length; c++) {
      if (cells[c] !== null) continue;
      const around = neighbours(c);
      const color = cells[around[0]];
      if (color === null) continue;
      if (!around.every((n) => cells[n] === color && alive[groupOf[n]])) continue;
      for (const g of new Set(around.map((n) => groupOf[n]))) eyes[g]++;
    }
    groups.forEach((_, g) => {
      if (alive[g] && eyes[g] < 2) {
        alive[g] = false;
        changed = true;
      }
    });
  }
  return alive;
}

/** The bot's opinion on every group of the final position (deterministic for one rng). */
export function judgeGroups(state: GameState, rng: Rng): GroupJudgement[] {
  const size = state.board.size as BoardSize;
  const groups = groupsOf(state);
  const rates = deadRates(state, groups, rng);
  const invaders = enclosedInvaders(state, groups, rates);
  const safe = sureAlive(state, groups);
  return groups.map((group, g) => {
    const deadRate = rates[g];
    const status: GroupStatus = safe[g]
      ? 'alive'
      : provedDead(state, group)
        ? 'proved-dead'
        : deadRate >= DEAD_RATE || invaders[g]
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
