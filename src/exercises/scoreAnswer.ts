// Feedback for `count` exercises with a `score` answer (spec docs/specs/M5-territory-counting.md
// AC 42–43): which typical counting mistake gives the typed number. Pure: engine facts only.
import type { Board } from '@/engine';
import { scoreFacts, type ScoreAnswer } from '@/lessons';

import type { FeedbackLine } from './attempts';

/**
 * The wrong-count line for `typed`, or null when it is right. The first rule whose value equals
 * `typed` (and differs from the right value) wins: dead stones kept, stones only, territory only,
 * neutral points added, the other side's number; else the generic line.
 */
export function classifyScoreAnswer(
  board: Board,
  answer: ScoreAnswer,
  typed: number,
): FeedbackLine | null {
  const facts = scoreFacts(board, answer.dead);
  const right = facts[answer.side][answer.of];
  if (typed === right) return null;
  const other = answer.side === 'B' ? 'W' : 'B';
  const kept = (answer.dead ?? []).length > 0 ? scoreFacts(board)[answer.side][answer.of] : null;
  const rules: { key: string; value: number | null }[] = [
    { key: 'fb.count.score.deadKept', value: kept },
    { key: 'fb.count.score.stonesOnly', value: facts[answer.side].stones },
    { key: 'fb.count.score.territoryOnly', value: facts[answer.side].territory },
    { key: 'fb.count.score.withDame', value: right + facts.dame.length },
    { key: 'fb.count.score.otherSide', value: facts[other][answer.of] },
  ];
  const hit = rules.find(({ value }) => value !== null && value !== right && value === typed);
  return hit ? { key: hit.key } : { key: 'fb.count.score.wrong' };
}

/** "6 stones + 7 points = 13." for the asked side, after the dead stones are removed. */
export function scoreRevealLine(board: Board, answer: ScoreAnswer): FeedbackLine {
  const side = scoreFacts(board, answer.dead)[answer.side];
  return {
    key: 'fb.count.score.reveal',
    params: { stones: side.stones, territory: side.territory, total: side.area },
  };
}
