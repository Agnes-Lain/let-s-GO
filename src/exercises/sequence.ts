// Multi-move problems (spec docs/specs/M5-life-death.md §4 C–D, §9.1): the pure judge of the
// `sequence` runner. No React, no timers: the runner schedules the replies this returns.
// Search-judged problems (spec docs/specs/M5-sequence-v2.md §3, AC 14–24) ask src/bot's forced
// capture search instead of the line; problems without `judge` are judged exactly as before.
import { judgeAttack, winningMoves, type AttackJudgement, type CaptureProblem } from '@/bot';
import {
  toVertex,
  type BoardSize,
  type Color,
  type GameState,
  type IllegalReason,
  type MoveFacts,
  type Point,
  type Vertex,
} from '@/engine';
import { libertyVertices, type MoveDef, type SequenceExercise } from '@/lessons';

import type { FeedbackLine } from './attempts';
import { checkExerciseMove, exerciseGame, playColor } from './engineAdapter';

/** Where the learner is in the line. */
export interface SequenceProgress {
  /** Index in `line` of the learner's next move (always even). */
  ply: number;
  /** The position the learner moves from. */
  state: GameState;
}

/** One stone played on the board: the learner's move or an automatic reply. */
export interface SequenceStone {
  color: Color;
  point: Point;
  facts: MoveFacts;
  /** The position after this stone. */
  state: GameState;
}

/** A legal learner move and what followed it. */
interface Played<K extends string> {
  /**
   * `next`: on the line, more learner moves follow the replies. `solved`: the line is complete
   * once the replies are played. `refuted`: a listed wrong first move and its scripted answer.
   * `wrong`: a legal move off the line (no reply), or a move the search rejects (with the
   * reply the search shows, if the defender has one).
   */
  kind: K;
  /** The learner's stone. */
  move: SequenceStone;
  /** Automatic stones, in order (0 or 1 on the line, the refutation for `refuted`). */
  replies: SequenceStone[];
  /** Why it is wrong (`refuted`, `wrong`); empty otherwise. */
  lines: FeedbackLine[];
  /** Search judging only: the position after the defender passed (no reply stone). */
  end?: GameState;
}

export type SequenceJudgement =
  | { kind: 'illegal'; reason: IllegalReason }
  | Played<'next'>
  | Played<'solved'>
  | Played<'refuted'>
  | Played<'wrong'>;

/** Whether the search judges the learner's moves (M5-sequence-v2 §3.6). */
export function isSearchJudged(exercise: SequenceExercise): boolean {
  return exercise.judge?.kind === 'search';
}

/** Learner moves in the problem: m = ceil(line.length / 2), or the search's `maxMoves`. */
export function learnerMoveCount(exercise: SequenceExercise): number {
  const least = Math.ceil(exercise.line.length / 2);
  return exercise.judge?.kind === 'search' ? (exercise.judge.maxMoves ?? least) : least;
}

/** "Move n of m": the learner's move number at `ply` (1-based, never above m). */
export function moveNumber(exercise: SequenceExercise, ply: number): number {
  return Math.min(Math.floor(ply / 2) + 1, learnerMoveCount(exercise));
}

/** The start of the problem: the setup after the prelude, the learner to move. */
export function sequenceStart(exercise: SequenceExercise): SequenceProgress {
  return { ply: 0, state: exerciseGame(exercise) };
}

/** The learner's expected point at `ply` (the hint ring, AC 27). */
export function expectedPoint(exercise: SequenceExercise, ply: number): Vertex | null {
  return exercise.line[ply]?.at ?? null;
}

function stone(state: GameState, move: MoveDef): SequenceStone {
  const result = playColor(state, move.color, move.at);
  // Validated lessons never get here (SEQ_ILLEGAL_MOVE).
  if (!result.ok) throw new Error(`sequence move ${move.color} ${move.at}: ${result.reason}`);
  return { color: move.color, point: result.facts.point, facts: result.facts, state: result.state };
}

/** Plays `moves` one after the other from `state`. */
function playLine(state: GameState, moves: readonly MoveDef[]): SequenceStone[] {
  const stones: SequenceStone[] = [];
  let at = state;
  for (const move of moves) {
    const next = stone(at, move);
    stones.push(next);
    at = next.state;
  }
  return stones;
}

/** Engine-fact feedback for a legal move off the line (AC 19–20). */
function offLineFeedback(exercise: SequenceExercise, after: GameState): FeedbackLine[] {
  if (exercise.goal.kind === 'capture') {
    const libs = libertyVertices(after, exercise.goal.target) ?? [];
    if (libs.length >= 2) {
      return [{ key: 'sequence.wrong.liberties', params: { count: libs.length } }];
    }
  }
  return [{ key: 'sequence.wrong.notLine' }];
}

/** Judges the learner's move at `point` from `progress` (spec AC 15–21, 26, 35). */
export function judgeSequence(
  exercise: SequenceExercise,
  progress: SequenceProgress,
  point: Point,
): SequenceJudgement {
  const { state, ply } = progress;
  const check = checkExerciseMove(state, point);
  if (!check.legal) return { kind: 'illegal', reason: check.reason };
  const color = state.toPlay;
  const at = toVertex(point, state.board.size as BoardSize);
  const result = playColor(state, color, at);
  if (!result.ok) return { kind: 'illegal', reason: result.reason };
  const move: SequenceStone = {
    color,
    point: result.facts.point,
    facts: result.facts,
    state: result.state,
  };

  if (isSearchJudged(exercise)) return judgeBySearch(exercise, progress, at);

  const expected = exercise.line[ply];
  if (expected && expected.at === at) {
    const reply = exercise.line[ply + 1];
    const replies = reply ? playLine(move.state, [reply]) : [];
    if (ply + 2 >= exercise.line.length) return { kind: 'solved', move, replies, lines: [] };
    return { kind: 'next', move, replies, lines: [] };
  }

  if (ply === 0) {
    const branch = (exercise.wrong ?? []).find((b) => b.line[0].at === at);
    if (branch) {
      return {
        kind: 'refuted',
        move,
        replies: playLine(move.state, branch.line.slice(1)),
        lines: [branch.whyKey ? { key: branch.whyKey } : { key: 'sequence.wrong.refuted' }],
      };
    }
  }
  return { kind: 'wrong', move, replies: [], lines: offLineFeedback(exercise, move.state) };
}

/** The search question at `progress`: capture the target with the learner moves left. */
function captureProblem(exercise: SequenceExercise, progress: SequenceProgress): CaptureProblem {
  const target = exercise.goal.kind === 'capture' ? exercise.goal.target : '';
  return {
    attacker: progress.state.toPlay,
    target,
    maxMoves: learnerMoveCount(exercise) - progress.ply / 2,
  };
}

/** AC 15–19: any legal move the search accepts goes on; a rejected one shows the reply + facts. */
function judgeBySearch(
  exercise: SequenceExercise,
  progress: SequenceProgress,
  at: Vertex,
): SequenceJudgement {
  const judged = judgeAttack(progress.state, captureProblem(exercise, progress), at);
  // The caller checked legality with the same engine.
  if (!judged.ok) return { kind: 'illegal', reason: judged.reason };
  const move: SequenceStone = {
    color: judged.facts.color,
    point: judged.facts.point,
    facts: judged.facts,
    state: judged.state,
  };
  if (judged.captured) return { kind: 'solved', move, replies: [], lines: [] };
  const reply = judged.reply;
  const replies: SequenceStone[] =
    reply.kind === 'play'
      ? [{ color: reply.facts.color, point: reply.point, facts: reply.facts, state: reply.state }]
      : [];
  const end = reply.kind === 'pass' ? { end: reply.state } : {};
  if (judged.forced) return { kind: 'next', move, replies, lines: [], ...end };
  return { kind: 'wrong', move, replies, lines: searchFeedback(exercise, judged), ...end };
}

/** AC 18: engine facts about a rejected move, in order (all that apply). */
function searchFeedback(
  exercise: SequenceExercise,
  judged: Extract<AttackJudgement, { ok: true }>,
): FeedbackLine[] {
  const target = exercise.goal.kind === 'capture' ? exercise.goal.target : null;
  if (!target) return [];
  const lines: FeedbackLine[] = [];
  const libsAfterMove = libertyVertices(judged.state, target)?.length ?? 0;
  if (libsAfterMove === 1) lines.push({ key: 'sequence.wrong.atariButEscapes' });
  const reply = judged.reply;
  if (reply.kind === 'play') {
    const chasers = reply.facts.captured.flat().length;
    if (chasers > 0) {
      lines.push({ key: 'sequence.wrong.chaserCaptured', params: { count: chasers } });
    } else {
      const libs = libertyVertices(reply.state, target)?.length ?? 0;
      lines.push({ key: 'sequence.wrong.afterReply', params: { count: libs } });
    }
  } else {
    lines.push({ key: 'sequence.wrong.liberties', params: { count: libsAfterMove } });
  }
  return lines;
}

/** Whether the moves played so far are the first `ply` moves of the line. */
function onLine(exercise: SequenceExercise, progress: SequenceProgress): boolean {
  const { ply, state } = progress;
  if (ply === 0) return true;
  const played = state.moves.slice(-ply);
  if (played.length !== ply) return false;
  const size = state.board.size as BoardSize;
  return played.every((m, i) => {
    const expected = exercise.line[i];
    return (
      m.type === 'play' && m.color === expected?.color && toVertex(m.point, size) === expected.at
    );
  });
}

/**
 * The hint ring (AC 20): `line[ply]` while the position follows the line; for a search-judged
 * problem that left the line, the first winning move of the search (fewest moves to capture,
 * then lowest column, then lowest row).
 */
export function hintPoint(exercise: SequenceExercise, progress: SequenceProgress): Vertex | null {
  if (!isSearchJudged(exercise) || onLine(exercise, progress)) {
    return expectedPoint(exercise, progress.ply);
  }
  const best = winningMoves(progress.state, captureProblem(exercise, progress)).moves[0];
  return best ? toVertex(best.point, progress.state.board.size as BoardSize) : null;
}

/** The position after a judged move and its replies (where the learner continues from). */
export function positionAfter(judgement: Exclude<SequenceJudgement, { kind: 'illegal' }>) {
  if (judgement.end) return judgement.end;
  const last = judgement.replies[judgement.replies.length - 1] ?? judgement.move;
  return last.state;
}

/** The progress after a `next` judgement (AC 15): two plies further, from the reply. */
export function advance(
  progress: SequenceProgress,
  judgement: Extract<SequenceJudgement, { kind: 'next' }>,
): SequenceProgress {
  return { ply: progress.ply + 2, state: positionAfter(judgement) };
}

/** Whether a mistake is undone by *Undo* (later ply, AC 20) or *Try again* (restart, AC 21). */
export function recoveryOf(ply: number, kind: 'refuted' | 'wrong'): 'undo' | 'restart' {
  return kind === 'wrong' && ply >= 2 ? 'undo' : 'restart';
}

/** The whole correct line from the start, stone by stone (the revealed answer, AC 23). */
export function answerStones(exercise: SequenceExercise): SequenceStone[] {
  return playLine(sequenceStart(exercise).state, exercise.line);
}

/** Stones of the learner's colour captured since the start (`sequence.captured`, AC 16). */
export function capturedSince(start: GameState, end: GameState, color: Color): number {
  return end.captures[color] - start.captures[color];
}
