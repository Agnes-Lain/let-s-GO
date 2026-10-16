// Answer checks that need no engine call (tap-point, choice, count). Pure.
import type { Vertex } from '@/engine';

export interface TapAllJudgement {
  correct: boolean;
  /** Selected points that are in the answer. */
  found: Vertex[];
  /** Selected points that are not. */
  extra: Vertex[];
}

/** Tap-all: the selection must equal the answer set. */
export function judgeTapAll(
  selected: readonly Vertex[],
  answer: readonly Vertex[],
): TapAllJudgement {
  const found = selected.filter((v) => answer.includes(v));
  const extra = selected.filter((v) => !answer.includes(v));
  return { correct: extra.length === 0 && found.length === answer.length, found, extra };
}
