// SGF import types (spec docs/specs/M5-sgf-import.md §5). Pure TS: type-only engine imports.
import type { Color } from '@/engine';
import type { LessonSize, MoveDef, Setup } from '@/lessons/schema';

/** A problem found in a file. `line` and `col` are 1-based and counted in characters. */
export interface SgfIssue {
  code: string;
  message: string;
  line: number;
  col: number;
  file?: string;
}

export interface SgfPosition {
  line: number;
  col: number;
}

/** One property value, unescaped (`\]` -> `]`, soft line breaks removed). */
export interface SgfValue extends SgfPosition {
  text: string;
}

export interface SgfProperty extends SgfPosition {
  /** Upper-case identifier: legacy lower-case letters are dropped (`AddBlack` -> `AB`). */
  id: string;
  values: SgfValue[];
}

/** One `;` node. Children: the first is the main line, the others are variations. */
export interface SgfNode extends SgfPosition {
  props: SgfProperty[];
  children: SgfNode[];
}

export type ParseResult =
  { ok: true; tree: SgfNode; warnings: SgfIssue[] } | { ok: false; errors: SgfIssue[] };

/** A tsumego problem, ready to be a `sequence` exercise. */
export interface SgfProblem {
  size: LessonSize;
  setup: Setup;
  toPlay: Color;
  line: MoveDef[];
  wrong: { line: MoveDef[] }[];
}

export type ConvertResult =
  { ok: true; problem: SgfProblem; warnings: SgfIssue[] } | { ok: false; errors: SgfIssue[] };

export interface ConvertOptions {
  /** Copied into every issue's `file`. */
  file?: string;
}

/**
 * A hand-authored lesson source (`content-src/<id>.src.json`): normal lesson JSON, except that a
 * `sequence` exercise may carry `"sgf": "e1.sgf"` (and optional `"whyKeys": {"d3": "<key>"}`)
 * instead of `size`, `setup`, `toPlay`, `line` and `wrong`.
 */
export interface LessonSource {
  exercises?: unknown;
  [key: string]: unknown;
}

export type ExpandResult =
  { ok: true; lesson: unknown; warnings: SgfIssue[] } | { ok: false; errors: SgfIssue[] };
