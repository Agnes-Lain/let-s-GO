// The only place in src/exercises that calls the rules engine (spec AC 96). The board stays
// rule-free; runners ask here whether a move is legal and what it did.
import {
  checkMove,
  createGame,
  legalMoves,
  pass,
  play,
  type CheckResult,
  type GameState,
  type IllegalReason,
  type Move,
  type MoveFacts,
  type PlayResult,
  type Point,
  type Vertex,
} from '@/engine';
import { goalMet, startState, type PlayMoveExercise, type SequenceExercise } from '@/lessons';
import { playAs } from '@/lessons/goals';

import type { FeedbackLine } from './attempts';
import { playMoveFeedback } from './feedback';

/** The exercise's starting position with `toPlay` to move. */
export function exerciseGame(exercise: PlayMoveExercise | SequenceExercise): GameState {
  return startState(exercise, exercise.toPlay);
}

/** Plays `at` for `color` (sequence lines: the turn is set, a stale ko ban dropped). */
export function playColor(state: GameState, color: 'B' | 'W', at: Vertex): PlayResult {
  return playAs(state, color, at);
}

export function checkExerciseMove(state: GameState, point: Point): CheckResult {
  return checkMove(state, point);
}

export type PlayMoveJudgement =
  | { kind: 'illegal'; reason: IllegalReason }
  | {
      kind: 'played';
      state: GameState;
      facts: MoveFacts;
      correct: boolean;
      /** Why it missed the goal (empty when correct). */
      lines: FeedbackLine[];
    };

/** Plays the learner's move and judges it against the exercise goal. */
export function judgePlayMove(
  exercise: PlayMoveExercise,
  state: GameState,
  point: Point,
): PlayMoveJudgement {
  const result = play(state, point);
  if (!result.ok) return { kind: 'illegal', reason: result.reason };
  const correct = goalMet(exercise.goal, state, result);
  return {
    kind: 'played',
    state: result.state,
    facts: result.facts,
    correct,
    lines: correct ? [] : playMoveFeedback(exercise.goal, result.facts),
  };
}

/** Plays or passes for `state.toPlay` (Capture Go games, src/exercises/botGame.ts). */
export function applyGameMove(
  state: GameState,
  move: Move,
): { ok: true; state: GameState; facts: MoveFacts | null } | { ok: false; reason: IllegalReason } {
  if (move.type === 'pass') {
    const result = pass(state);
    return result.ok ? { ok: true, state: result.state, facts: null } : result;
  }
  const result: PlayResult = play(state, move.point);
  return result.ok ? { ok: true, state: result.state, facts: result.facts } : result;
}

/** Whether `state.toPlay` has a legal point to play. */
export function hasLegalPoint(state: GameState): boolean {
  return legalMoves(state).length > 0;
}

/** The intro's empty 5×5 practice board, Black to play (M6-settings AC 29–30). */
export function touchDemoGame(): GameState {
  return createGame(5);
}

/** Plays on the practice board; colours alternate, legality comes from the engine (AC 30). */
export function playTouchDemo(state: GameState, point: Point): PlayResult {
  return play(state, point);
}
