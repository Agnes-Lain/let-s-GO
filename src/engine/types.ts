// Public types of the Go rules engine (spec docs/specs/M1-rules-engine.md §3).
// Some types (Move, MoveFacts, PlayResult, ScoreResult, …) are used by later M1 PRs.

export type Color = 'B' | 'W';

export type BoardSize = 5 | 7 | 9 | 13 | 19;

/** x: 0 = column a (left). y: 0 = row 1 (bottom). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Lesson/JSON notation, lowercase: 'c3', 'j9', 't19'. Letters a–t without 'i'. */
export type Vertex = string;

/** `cells` index is `y * size + x`; `null` is an empty point. */
export interface Board {
  readonly size: BoardSize;
  readonly cells: readonly (Color | null)[];
}

export interface GameOptions {
  /** Default: defaultKomi(size). Must be a finite multiple of 0.5. */
  komi?: number;
  /** Initial stones (lessons, handicap later). */
  setup?: { B?: Vertex[]; W?: Vertex[] };
  /** Default 'B'. */
  toPlay?: Color;
}

export type Move =
  | { readonly type: 'play'; readonly color: Color; readonly point: Point }
  | { readonly type: 'pass'; readonly color: Color };

export interface GameState {
  readonly board: Board;
  readonly toPlay: Color;
  readonly komi: number;
  /** Forbidden for `toPlay` on this turn only (simple ko). */
  readonly koPoint: Point | null;
  /** Stones captured BY each color. */
  readonly captures: { readonly B: number; readonly W: number };
  readonly consecutivePasses: number;
  /** True after two consecutive passes. */
  readonly isOver: boolean;
  /** History, not including setup stones. */
  readonly moves: readonly Move[];
}

export type IllegalReason = 'off-board' | 'occupied' | 'suicide' | 'ko' | 'game-over';

/** A chain of same-colored stones connected along the lines. Lists sorted by column, then row. */
export interface Group {
  color: Color;
  stones: Point[];
  liberties: Point[];
}

export interface MoveFacts {
  color: Color;
  point: Point;
  /** One array per captured group; [] if none. */
  captured: Point[][];
  /** Group containing the new stone, after captures. */
  playedGroup: Group;
  /** Opponent groups touching the new stone that now have exactly 1 liberty. */
  opponentAtari: Group[];
  /** playedGroup has exactly 1 liberty. */
  selfAtari: boolean;
  /** Ko point created by this move, if any. */
  koPoint: Point | null;
}

export type PlayResult =
  { ok: true; state: GameState; facts: MoveFacts } | { ok: false; reason: IllegalReason };

export type PassResult = { ok: true; state: GameState } | { ok: false; reason: 'game-over' };

export interface ScoreSide {
  stones: number;
  territory: number;
  komi: number;
  total: number;
}

export interface ScoreResult {
  /** black.komi is always 0. */
  black: ScoreSide;
  white: ScoreSide;
  /** Empty points owned by nobody. */
  dame: Point[];
  /** After expanding to whole groups. */
  deadStones: Point[];
  /** Per cell, after removing dead stones. */
  ownership: readonly (Color | null)[];
  /** null = draw. */
  winner: Color | null;
  /** >= 0 */
  margin: number;
  /** 'B+5.5' | 'W+1.5' | 'Draw' */
  result: string;
}

export type EngineErrorCode =
  | 'invalid-size'
  | 'invalid-vertex'
  | 'invalid-setup'
  | 'invalid-komi'
  | 'invalid-ascii'
  | 'invalid-dead-stone';

/**
 * Thrown only for programmer or content mistakes (bad size, bad vertex, impossible setup).
 * Illegal moves are normal while learning and are returned as results instead.
 */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    // Keep `instanceof EngineError` working when classes are transpiled to ES5.
    Object.setPrototypeOf(this, EngineError.prototype);
  }
}
