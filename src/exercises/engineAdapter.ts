// The only place in src/exercises that calls the rules engine (spec AC 96). The board stays
// rule-free; runners ask here whether a move is legal and what it did.
import {
  checkMove,
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
} from '@/engine';
import { goalMet, startState, type PlayMoveExercise } from '@/lessons';

import type { FeedbackLine } from './attempts';
import { playMoveFeedback } from './feedback';

/** The exercise's starting position with `toPlay` to move. */
export function exerciseGame(exercise: PlayMoveExercise): GameState {
  return startState(exercise, exercise.toPlay);
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
