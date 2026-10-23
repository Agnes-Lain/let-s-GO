// Test helpers for lesson tests: positions from ASCII boards and a sample-based lesson builder.
import { parseBoard, toVertex, type Vertex } from '@/engine';

import sample from './u00-sample.json';
import type { LessonSize, Setup } from '../schema';

/** `{ size, setup }` from an ASCII board ('.' empty, 'X' black, 'O' white). */
export function position(ascii: string): { size: LessonSize; setup: Setup } {
  const { board } = parseBoard(ascii);
  const B: Vertex[] = [];
  const W: Vertex[] = [];
  board.cells.forEach((cell, i) => {
    const at = toVertex({ x: i % board.size, y: Math.floor(i / board.size) }, board.size);
    if (cell === 'B') B.push(at);
    if (cell === 'W') W.push(at);
  });
  const setup: Setup = {};
  if (B.length) setup.B = B.sort();
  if (W.length) setup.W = W.sort();
  return { size: board.size as LessonSize, setup };
}

/** A deep copy of the sample lesson as plain JSON, to mutate in a test. */
export function sampleLesson(): Record<string, any> {
  return JSON.parse(JSON.stringify(sample));
}

/** The sample with exercise `index` replaced (other exercises stay valid). */
export function withExercise(index: number, exercise: Record<string, unknown>) {
  const lesson = sampleLesson();
  lesson.exercises[index] = exercise;
  return lesson;
}

/** Knows every key: for tests that do not care about texts. */
export const allTexts = { hasText: () => true };
