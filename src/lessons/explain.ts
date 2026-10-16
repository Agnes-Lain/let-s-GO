// Explanation steps as board frames (spec §6.2). Pure: the player only draws what this returns.
import {
  parseVertex,
  play,
  type BoardSize,
  type Color,
  type GameState,
  type Point,
} from '@/engine';

import { startState } from './goals';
import type { ExplainStep, HighlightKind, Lesson, MarkerDef } from './schema';

export type Cells = readonly (Color | null)[];

export interface MoveFrame {
  /** Stones after the move (captures removed). */
  cells: Cells;
  move: Point;
  color: Color;
  /** Stones this move captured, and their colour. */
  captured: Point[];
  capturedColor: Color;
}

export interface StepHighlight {
  kind: HighlightKind;
  points: Point[];
}

export type StepMarker =
  | { kind: 'circle' | 'triangle' | 'square' | 'cross'; point: Point }
  | { kind: 'label'; point: Point; text: string };

export interface StepFrames {
  size: BoardSize;
  /** The step's start position. */
  start: Cells;
  /** One frame per move, in order. Empty for a step without moves. */
  moves: MoveFrame[];
  /** Shown on the start position only. */
  highlights: StepHighlight[];
  /** Shown for the whole step. */
  markers: StepMarker[];
  textKey: string;
}

/** The last frame's stones (the step's END position). */
export function endCells(step: StepFrames): Cells {
  return step.moves.length > 0 ? step.moves[step.moves.length - 1].cells : step.start;
}

export function toStepMarkers(markers: readonly MarkerDef[] | undefined, size: BoardSize) {
  return (markers ?? []).map((m): StepMarker =>
    m.kind === 'label'
      ? { kind: 'label', point: parseVertex(m.at, size), text: m.text }
      : { kind: m.kind, point: parseVertex(m.at, size) },
  );
}

/**
 * Frames of every step of a validated lesson. A step without a board continues from the end of
 * the previous step; moves may repeat a colour (the turn is set for each move).
 */
export function explainFrames(lesson: Lesson): StepFrames[] {
  let state: GameState | null = null;
  return (lesson.explain ?? []).map((step: ExplainStep) => {
    if (step.board) state = startState(step.board);
    if (!state) throw new Error(`lesson ${lesson.id}: the first explain step needs a board`);
    const size = state.board.size;
    const start = state.board.cells;
    const moves: MoveFrame[] = [];
    for (const move of step.moves ?? []) {
      const before: GameState =
        state.toPlay === move.color ? state : { ...state, toPlay: move.color, koPoint: null };
      const result = play(before, move.at);
      if (!result.ok) throw new Error(`lesson ${lesson.id}: illegal move ${move.color} ${move.at}`);
      state = result.state;
      moves.push({
        cells: state.board.cells,
        move: result.facts.point,
        color: move.color,
        captured: result.facts.captured.flat(),
        capturedColor: move.color === 'B' ? 'W' : 'B',
      });
    }
    return {
      size,
      start,
      moves,
      highlights: (step.highlights ?? []).map((h) => ({
        kind: h.kind,
        points: h.points.map((v) => parseVertex(v, size)),
      })),
      markers: toStepMarkers(step.markers, size),
      textKey: step.textKey,
    };
  });
}
