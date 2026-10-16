// The only place in src/exercises that calls the rules engine (spec AC 96). The board stays
// rule-free; runners ask here whether a move is legal and what it did.
import {
  checkMove,
  play,
  type CheckResult,
  type GameState,
  type IllegalReason,
  type MoveFacts,
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
