// `.src.json` -> lesson JSON (spec docs/specs/M5-sgf-import.md §5, AC 19). Pure: the caller
// reads the files (`readSgf`), so this module has no I/O.
//
// Text keys, goal and id come from the source. Default key pattern, as in the existing content:
//   lesson.<lessonId>.<exerciseId>.prompt | .hint | .explain
// The result is not validated here: run `validateLesson` on it (the import script does).

import { convertSgf } from './convert';
import { parseSgf } from './parse';
import type { ExpandResult, LessonSource, SgfIssue } from './types';

/** Filled in from the SGF: a source exercise with `sgf` must not set them itself. */
const FROM_SGF = ['size', 'setup', 'toPlay', 'line', 'wrong'];

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function expandLessonSource(
  src: LessonSource,
  readSgf: (path: string) => string,
): ExpandResult {
  const errors: SgfIssue[] = [];
  const warnings: SgfIssue[] = [];
  const sourceError = (code: string, message: string, file?: string) => {
    const issue: SgfIssue = { code, message, line: 1, col: 1 };
    if (file !== undefined) issue.file = file;
    errors.push(issue);
  };

  const list = Array.isArray(src.exercises) ? src.exercises : null;
  const exercises = (list ?? []).map((item, i) => {
    if (!isObject(item) || !('sgf' in item)) return item;
    const where = `exercises[${i}]`;
    const { sgf, whyKeys, ...rest } = item;
    if (typeof sgf !== 'string' || sgf === '') {
      sourceError('SRC_BAD_EXERCISE', `${where}: "sgf" must be a file name such as "e1.sgf"`);
      return item;
    }
    if (rest.type !== 'sequence') {
      sourceError('SRC_BAD_EXERCISE', `${where}: "sgf" is only for "type": "sequence"`, sgf);
      return item;
    }
    const conflicts = FROM_SGF.filter((key) => key in rest);
    if (conflicts.length > 0) {
      sourceError(
        'SRC_BAD_EXERCISE',
        `${where}: ${conflicts.join(', ')} come from the SGF file; remove them from the source`,
        sgf,
      );
      return item;
    }

    let text: string;
    try {
      text = readSgf(sgf);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push({
        code: 'SGF_FILE_NOT_FOUND',
        message: `${where}: cannot read "${sgf}" (${reason})`,
        line: 1,
        col: 1,
        file: sgf,
      });
      return item;
    }
    const parsed = parseSgf(text);
    if (!parsed.ok) {
      errors.push(...parsed.errors.map((e) => ({ ...e, file: sgf })));
      return item;
    }
    const converted = convertSgf(parsed.tree, { file: sgf });
    if (!converted.ok) {
      errors.push(...converted.errors);
      return item;
    }
    warnings.push(...converted.warnings);
    const { size, setup, toPlay, line } = converted.problem;
    let wrong: { line: unknown[]; whyKey?: unknown }[] = converted.problem.wrong;

    if (whyKeys !== undefined) {
      if (!isObject(whyKeys)) {
        sourceError('SRC_BAD_EXERCISE', `${where}: "whyKeys" must be an object`, sgf);
        return item;
      }
      const firsts = new Set(wrong.map((branch) => branch.line[0] && (branch.line[0] as Json).at));
      for (const point of Object.keys(whyKeys)) {
        if (!firsts.has(point)) {
          sourceError(
            'SRC_UNKNOWN_WHY',
            `${where}: whyKeys "${point}" is not the first move of a wrong variation in ${sgf}`,
            sgf,
          );
        }
      }
      wrong = wrong.map((branch) => {
        const key = whyKeys[(branch.line[0] as Json).at as string];
        return key === undefined ? branch : { ...branch, whyKey: key };
      });
    }

    const { id, type, ...others } = rest;
    return {
      id,
      type,
      size,
      setup,
      toPlay,
      ...others,
      line,
      ...(wrong.length > 0 ? { wrong } : {}),
    };
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, lesson: list ? { ...src, exercises } : src, warnings };
}
