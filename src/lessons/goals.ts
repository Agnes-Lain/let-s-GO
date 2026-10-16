// Goal checks and solutions (spec §4.3). Pure: uses src/engine only.
import {
  createGame,
  groupAt,
  legalMoves,
  play,
  toVertex,
  type GameState,
  type MoveFacts,
  type PlayResult,
  type Vertex,
} from '@/engine';

import type {
  ChoiceExercise,
  CountExercise,
  Exercise,
  Goal,
  PlayMoveExercise,
  PositionDef,
  Solution,
  TapPointExercise,
} from './schema';

/** The starting game of an exercise or step board. `toPlay` defaults to Black. */
export function startState(position: PositionDef, toPlay: 'B' | 'W' = 'B'): GameState {
  return createGame(position.size, { setup: position.setup, toPlay });
}

/** Total number of stones the move captured. */
export function capturedCount(facts: MoveFacts): number {
  return facts.captured.reduce((sum, group) => sum + group.length, 0);
}

/** Whether a legal move met the goal. Groups "after the move" are read from `result.state`. */
export function goalMet(
  goal: Goal,
  before: GameState,
  result: Extract<PlayResult, { ok: true }>,
): boolean {
  const { facts, state } = result;
  switch (goal.kind) {
    case 'point':
      return goal.points.includes(toVertex(facts.point, before.board.size));
    case 'capture':
      return capturedCount(facts) >= (goal.min ?? 1);
    case 'atari':
      return facts.opponentAtari.length >= 1;
    case 'connect': {
      const group = groupAt(state.board, goal.a);
      const b = groupAt(state.board, goal.b);
      return group !== null && b !== null && sameStones(group.stones, b.stones);
    }
    case 'save':
      return (groupAt(state.board, goal.target)?.liberties.length ?? 0) >= 2;
  }
}

/** Every legal move of `toPlay` (sorted by column, then row) that meets the goal. */
export function playMoveSolutions(state: GameState, goal: Goal): Vertex[] {
  const size = state.board.size;
  return legalMoves(state)
    .filter((point) => {
      const result = play(state, point);
      return result.ok && goalMet(goal, state, result);
    })
    .map((point) => toVertex(point, size));
}

/** Liberties of the group on `at` as vertices, or null when `at` is empty. */
export function libertyVertices(state: GameState, at: Vertex): Vertex[] | null {
  const group = groupAt(state.board, at);
  return group ? group.liberties.map((p) => toVertex(p, state.board.size)) : null;
}

export function getSolution(exercise: TapPointExercise | PlayMoveExercise): { points: Vertex[] };
export function getSolution(exercise: ChoiceExercise): { index: number };
export function getSolution(exercise: CountExercise): { value: number };
export function getSolution(exercise: Exercise): Solution;
/** What counts as the right answer for an (already validated) exercise. */
export function getSolution(exercise: Exercise): Solution {
  switch (exercise.type) {
    case 'tap-point':
      return { points: tapPointAnswer(exercise) };
    case 'play-move':
      return { points: playMoveSolutions(startState(exercise, exercise.toPlay), exercise.goal) };
    case 'choice':
      return { index: exercise.options.findIndex((option) => option.correct === true) };
    case 'count': {
      const { answer } = exercise;
      if (typeof answer === 'number') return { value: answer };
      return { value: libertyVertices(startState(exercise), answer.libertiesOf)?.length ?? 0 };
    }
  }
}

/**
 * Points ringed when the answer is revealed: the solution points; for a count of liberties, the
 * liberties; none for a choice or a plain number.
 */
export function solutionPoints(exercise: Exercise): Vertex[] {
  switch (exercise.type) {
    case 'tap-point':
    case 'play-move':
      return getSolution(exercise).points;
    case 'count':
      return typeof exercise.answer === 'number'
        ? []
        : (libertyVertices(startState(exercise), exercise.answer.libertiesOf) ?? []);
    case 'choice':
      return [];
  }
}

function tapPointAnswer(exercise: TapPointExercise): Vertex[] {
  const { answer } = exercise;
  if ('points' in answer) return [...answer.points];
  return libertyVertices(startState(exercise), answer.libertiesOf) ?? [];
}

function sameStones(
  a: readonly { x: number; y: number }[],
  b: readonly { x: number; y: number }[],
) {
  return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
}
