// Goal checks and solutions (spec §4.3). Pure: uses src/engine only.
import {
  checkMove,
  createGame,
  groupAt,
  legalMoves,
  play,
  toVertex,
  type GameState,
  type MoveFacts,
  type PlayResult,
  type Point,
  type Vertex,
} from '@/engine';

import type {
  ChoiceExercise,
  CountExercise,
  Exercise,
  Goal,
  PlayBotExercise,
  PlayMoveExercise,
  Solution,
  StartDef,
  TapPointExercise,
} from './schema';

/**
 * The starting game of an exercise or step board. `toPlay` defaults to Black. With a `prelude`,
 * its moves are played from the setup and the side to move (and ko ban) is the one after them;
 * `toPlay` is then ignored (the validator checks it matches, code PRELUDE_TURN).
 */
export function startState(position: StartDef, toPlay: 'B' | 'W' = 'B'): GameState {
  const prelude = position.prelude ?? [];
  const first = prelude.length > 0 ? prelude[0].color : toPlay;
  let state = createGame(position.size, { setup: position.setup, toPlay: first });
  for (const move of prelude) {
    const result = playAs(state, move.color, move.at);
    // Validated lessons never get here (PRELUDE_ILLEGAL).
    if (!result.ok) throw new Error(`prelude move ${move.color} ${move.at}: ${result.reason}`);
    state = result.state;
  }
  return state;
}

/** The point of the last stone played (the prelude's last move), or null. */
export function lastPlayedPoint(state: GameState): Point | null {
  const last = state.moves[state.moves.length - 1];
  return last?.type === 'play' ? last.point : null;
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

export function getSolution(exercise: TapPointExercise | PlayMoveExercise | PlayBotExercise): {
  points: Vertex[];
};
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
    case 'play-bot':
      // A game has no fixed answer: the hint point is computed live by the bot (spec §5.5).
      return { points: [] };
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
    case 'play-bot':
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

/** Plays `at` for `color` (the turn is set, a stale ko ban dropped): explain steps, fixtures. */
export function playAs(state: GameState, color: 'B' | 'W', at: Vertex): PlayResult {
  const turn = state.toPlay === color ? state : { ...state, toPlay: color, koPoint: null };
  return play(turn, at);
}

/** Whether `state.toPlay` may play at `at`. */
export function isLegalMove(state: GameState, at: Vertex): boolean {
  return checkMove(state, at).legal;
}

/** Whether `state.toPlay` has at least one legal point (play-bot rule BOT_NO_MOVE). */
export function hasLegalMove(state: GameState): boolean {
  return legalMoves(state).length > 0;
}

/**
 * Play-bot rule BOT_START_LOST (spec §7.2), for "first to capture 1" with the learner to move:
 * true when every legal learner move captures nothing and lets the bot capture at once.
 * 2-ply exhaustive (at most 81 × 81 plays on 9×9).
 */
export function lostBeforeStart(state: GameState): boolean {
  return legalMoves(state).every((point) => {
    const result = play(state, point);
    if (!result.ok) return true;
    if (capturedCount(result.facts) > 0) return false; // the learner wins at once
    const reply = result.state;
    return legalMoves(reply).some((p) => {
      const answer = play(reply, p);
      return answer.ok && capturedCount(answer.facts) > 0;
    });
  });
}
