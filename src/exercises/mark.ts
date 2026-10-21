// `mark` exercises (spec docs/specs/M5-territory-counting.md AC 22–34): which tap marks what, and
// how a set of marks is judged. Pure: engine facts only, no React.
import { groupAt, type Board, type Vertex } from '@/engine';
import { groupStones, markAnswer, scoreFacts, type MarkExercise } from '@/lessons';

import type { FeedbackLine } from './attempts';

export type MarkSpec = Pick<MarkExercise, 'mark' | 'side' | 'dead' | 'whyKeys'>;

export type MarkTap =
  /** `points` were added to or removed from the marks (a whole group for dead stones). */
  | { kind: 'toggled'; marks: Vertex[]; points: Vertex[]; added: boolean }
  /** Nothing marked; a note that is not a mistake (AC 24, 32). */
  | { kind: 'note'; line: FeedbackLine };

export interface MarkJudgement {
  correct: boolean;
  /** Marks that stay (they are in the answer). */
  keep: Vertex[];
  /** Marks that flash and are removed. */
  extra: Vertex[];
  /** At most two feedback lines (AC 26, 33). */
  lines: FeedbackLine[];
}

/** What a tap on `at` does with the current `marks`. */
export function tapMark(
  board: Board,
  spec: MarkSpec,
  marks: readonly Vertex[],
  at: Vertex,
): MarkTap {
  const group = groupAt(board, at);
  if (spec.mark === 'territory') {
    if (group) return { kind: 'note', line: { key: 'fb.mark.extra.stone' } };
    const added = !marks.includes(at);
    return {
      kind: 'toggled',
      marks: added ? [...marks, at] : marks.filter((v) => v !== at),
      points: [at],
      added,
    };
  }
  if (!group) return { kind: 'note', line: { key: 'fb.mark.empty' } };
  const points = groupStones(board, [at]);
  const added = !marks.includes(at);
  const rest = marks.filter((v) => !points.includes(v));
  return {
    kind: 'toggled',
    marks: added ? sortVertices([...rest, ...points]) : rest,
    points,
    added,
  };
}

/** Judges the marks against the engine's answer and phrases what is wrong. */
export function judgeMarks(board: Board, spec: MarkSpec, marks: readonly Vertex[]): MarkJudgement {
  const answer = markAnswer(board, spec);
  const keep = marks.filter((v) => answer.includes(v));
  const extra = marks.filter((v) => !answer.includes(v));
  const missing = answer.length - keep.length;
  if (extra.length === 0 && missing === 0) return { correct: true, keep, extra, lines: [] };

  const lines: FeedbackLine[] =
    spec.mark === 'territory' ? territoryLines(board, spec, extra) : deadLines(board, spec, extra);
  if (missing > 0) lines.push({ key: 'fb.mark.missing', params: { count: missing } });
  return { correct: false, keep, extra, lines: lines.slice(0, 2) };
}

/** (a) neutral points, (b) the other side's territory — each with its points. */
function territoryLines(board: Board, spec: MarkSpec, extra: readonly Vertex[]): FeedbackLine[] {
  const facts = scoreFacts(board);
  const other = spec.side === 'W' ? 'B' : 'W';
  const dame = extra.filter((v) => facts.dame.includes(v));
  const theirs = extra.filter((v) => facts[other].points.includes(v));
  const lines: FeedbackLine[] = [];
  if (dame.length > 0) lines.push({ key: 'fb.mark.extra.dame', params: { points: list(dame) } });
  if (theirs.length > 0)
    lines.push({ key: 'fb.mark.extra.other', params: { points: list(theirs) } });
  return lines;
}

/** An alive group was marked: its `whyKeys` text, else the generic line with its first stone. */
function deadLines(board: Board, spec: MarkSpec, extra: readonly Vertex[]): FeedbackLine[] {
  if (extra.length === 0) return [];
  const why = Object.entries(spec.whyKeys ?? {}).find(([at]) => extra.includes(at));
  if (why) return [{ key: why[1] }];
  const first = groupStones(board, [sortVertices(extra)[0]])[0];
  return [{ key: 'fb.mark.extra.alive', params: { point: first } }];
}

function list(points: readonly Vertex[]): string {
  return sortVertices(points).join(', ');
}

const COLUMNS = 'abcdefghjklmnopqrst';
function sortVertices(points: readonly Vertex[]): Vertex[] {
  const key = (v: Vertex) => [COLUMNS.indexOf(v[0]), Number(v.slice(1))] as const;
  return [...points].sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]);
}
