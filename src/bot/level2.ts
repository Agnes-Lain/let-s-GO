// Bot level 2 — 普通 Normal (spec docs/specs/M6-bot-levels.md §6.2): scores every legal point with
// rules of thumb and a one-move look-ahead, never blunders on purpose. Its scores also pick the
// candidates of level 3. Pure: reads the engine, never changes a state.
import { legalMoves, play, type Board, type Color, type GameState, type Point } from '@/engine';

import { analyzeMoves, exposedStones } from './analysis';
import { isOwnEye } from './eyes';
import { forcedCapture } from './forcedCapture';
import type { BotReason } from './types';

/** Line preferences apply until this move number (the opening). */
export const OPENING_MOVES = 30;
/** An empty region bordered by one colour and at most this big counts as settled territory. */
export const SETTLED_REGION_MAX = 12;
/** A best score below this means only self-atari moves are left: the bot passes (AC 12). */
export const PASS_BELOW = -6;
/** Node cap of the ladder check before calling a group "saved" (§6.2 rule 2). */
const LADDER_NODES = 800;

export type MoveKind = Extract<BotReason, 'capture' | 'save' | 'atari' | 'pressure' | 'random'>;

export interface ScoredMove {
  point: Point;
  score: number;
  kind: MoveKind;
}

function other(color: Color): Color {
  return color === 'B' ? 'W' : 'B';
}

/** 0 = first line (edge), 1 = second line, … */
export function lineOf(p: Point, size: number): number {
  return Math.min(p.x, p.y, size - 1 - p.x, size - 1 - p.y);
}

/**
 * Owner of each empty point that lies in a settled region: an empty region bordered by stones of
 * one colour only and at most SETTLED_REGION_MAX points big. Other points are null.
 */
export function settledOwners(board: Board): (Color | null)[] {
  const { size, cells } = board;
  const owners: (Color | null)[] = Array<Color | null>(cells.length).fill(null);
  const seen = new Uint8Array(cells.length);
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== null || seen[start]) continue;
    const region = [start];
    seen[start] = 1;
    const borders = new Set<Color>();
    for (let i = 0; i < region.length; i++) {
      const c = region[i];
      const x = c % size;
      const around = [x > 0 ? c - 1 : -1, x < size - 1 ? c + 1 : -1, c - size, c + size];
      for (const n of around) {
        if (n < 0 || n >= cells.length) continue;
        const stone = cells[n];
        if (stone !== null) borders.add(stone);
        else if (!seen[n]) {
          seen[n] = 1;
          region.push(n);
        }
      }
    }
    if (borders.size === 1 && region.length <= SETTLED_REGION_MAX) {
      const owner = [...borders][0];
      for (const c of region) owners[c] = owner;
    }
  }
  return owners;
}

/** Distinct own groups next to `p` (by a flood over the board). */
function ownGroupsTouching(board: Board, p: Point, color: Color): number {
  const { size, cells } = board;
  const group = new Int32Array(cells.length).fill(-1);
  let groups = 0;
  const label = (start: number) => {
    const stack = [start];
    group[start] = groups;
    while (stack.length > 0) {
      const c = stack.pop() as number;
      const x = c % size;
      for (const n of [x > 0 ? c - 1 : -1, x < size - 1 ? c + 1 : -1, c - size, c + size]) {
        if (n >= 0 && n < cells.length && cells[n] === color && group[n] === -1) {
          group[n] = groups;
          stack.push(n);
        }
      }
    }
    groups++;
  };
  const touching = new Set<number>();
  for (const [x, y] of [
    [p.x - 1, p.y],
    [p.x + 1, p.y],
    [p.x, p.y - 1],
    [p.x, p.y + 1],
  ]) {
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    const c = y * size + x;
    if (cells[c] !== color) continue;
    if (group[c] === -1) label(c);
    touching.add(group[c]);
  }
  return touching.size;
}

/** The ladder check: can the opponent capture the group on `p` after this move? */
function ladderDead(after: GameState, p: Point, color: Color): boolean {
  return forcedCapture(after, {
    attacker: other(color),
    target: p,
    maxMoves: 8,
    maxNodes: LADDER_NODES,
  }).forced;
}

/** True when the opponent, extending at the group's last liberty, gets ≥ 3 liberties. */
function canEscape(after: GameState, liberty: Point): boolean {
  const result = play(after, liberty);
  return result.ok && result.facts.playedGroup.liberties.length >= 3;
}

/**
 * Every candidate point for `state.toPlay` with its score (§6.2), best first; ties keep the
 * engine's point order (column, then row). Own eyes are never candidates; quiet moves inside a
 * settled region (own territory, or the opponent's) are left out.
 */
export function scoreMoves(state: GameState): ScoredMove[] {
  const color = state.toPlay;
  const { board } = state;
  const size = board.size;
  const points = legalMoves(state).filter((p) => !isOwnEye(board, p, color));
  const analyses = analyzeMoves(board, color, points);
  const exposedBefore = exposedStones(board, color);
  const settled = settledOwners(board);
  const opening = state.moves.length < OPENING_MOVES;
  const scored: ScoredMove[] = [];

  for (const a of analyses) {
    const p = a.point;
    let score = 0;
    let kind: MoveKind = 'random';
    let tactical = false;
    let after: GameState | null = null;
    const playIt = () => {
      if (after) return after;
      const result = play(state, p);
      if (!result.ok) throw new Error('level2: legal move refused');
      after = result.state;
      return after;
    };

    // 1. Capture (+10 per stone, +5 when it also removes an atari on own stones), unless the
    //    capturing group is left in atari so that a reply takes ≥ 2 stones back.
    let badCapture = false;
    if (a.captured > 0) {
      const result = play(state, p);
      if (!result.ok) throw new Error('level2: legal move refused');
      after = result.state;
      badCapture = result.facts.selfAtari && result.facts.playedGroup.stones.length >= 2;
      if (!badCapture) {
        score += 10 * a.captured + (exposedBefore > 0 && a.exposed < exposedBefore ? 5 : 0);
        kind = 'capture';
        tactical = true;
      }
    }

    // 2. Save own stones in atari by extending to ≥ 2 liberties (not into a proven ladder).
    if (a.captured === 0 && exposedBefore > 0 && a.exposed < exposedBefore && a.liberties >= 2) {
      const saved = exposedBefore - a.exposed;
      if (a.liberties > 2 || !ladderDead(playIt(), p, color)) {
        score += 8 + saved;
        kind = 'save';
        tactical = true;
      }
    }

    // 3. Atari (叫吃 jiàochī) on an opponent group: +4, or +1 when it can simply run away.
    if (a.opponentAtari.length > 0 && !a.selfAtari && a.liberties >= 2) {
      const next = playIt();
      let best = 0;
      for (const group of atariGroupsNear(next, p, other(color))) {
        best = Math.max(best, canEscape(next, group) ? 1 : 4);
      }
      if (best > 0) {
        score += best;
        if (kind === 'random') kind = 'atari';
        if (best === 4) tactical = true;
      }
    }

    // 4. Shape: connect two own groups (+3), block / hane on the 3rd line (+2), extend (+1).
    const ownTouching = ownGroupsTouching(board, p, color);
    const line = lineOf(p, size);
    if (ownTouching >= 2) score += 3;
    else if (a.touched > 0 && line === 2) score += 2;
    if (ownTouching >= 1) score += 1;
    if (kind === 'random' && a.touched > 0) kind = 'pressure';

    // 5. Line preference in the opening.
    if (opening) {
      if (line === 0) score -= 3;
      else if (line === 1) score -= 1;
      else if (line === 2 || line === 3) score += 1.5;
    }

    // 6. Self-atari (a non-capturing move left with one liberty, or a bad capture).
    if ((a.selfAtari && a.captured === 0) || badCapture) score -= 12;

    // Quiet moves inside settled territory are useless (area scoring) or hopeless invasions.
    const index = p.y * size + p.x;
    if (!tactical && settled[index] !== null) continue;

    scored.push({ point: p, score, kind });
  }

  return scored.sort((a, b) => b.score - a.score);
}

/** The lone liberty of each opponent group next to `p` that is in atari after the move. */
function atariGroupsNear(after: GameState, p: Point, opponent: Color): Point[] {
  const { size, cells } = after.board;
  const liberties: Point[] = [];
  const seen = new Set<number>();
  for (const [x, y] of [
    [p.x - 1, p.y],
    [p.x + 1, p.y],
    [p.x, p.y - 1],
    [p.x, p.y + 1],
  ]) {
    if (x < 0 || y < 0 || x >= size || y >= size || cells[y * size + x] !== opponent) continue;
    const libs = groupLiberties(after.board, y * size + x, seen);
    if (libs.length === 1) liberties.push(libs[0]);
  }
  return liberties;
}

function groupLiberties(board: Board, start: number, seen: Set<number>): Point[] {
  if (seen.has(start)) return [];
  const { size, cells } = board;
  const color = cells[start];
  const stack = [start];
  seen.add(start);
  const libs = new Set<number>();
  while (stack.length > 0) {
    const c = stack.pop() as number;
    const x = c % size;
    for (const n of [x > 0 ? c - 1 : -1, x < size - 1 ? c + 1 : -1, c - size, c + size]) {
      if (n < 0 || n >= cells.length) continue;
      if (cells[n] === null) libs.add(n);
      else if (cells[n] === color && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...libs].map((c) => ({ x: c % size, y: Math.floor(c / size) }));
}

/** The best-scored moves worth playing (score ≥ PASS_BELOW), best first. */
export function playableMoves(state: GameState): ScoredMove[] {
  return scoreMoves(state).filter((m) => m.score >= PASS_BELOW);
}
