// SGF import pipeline (spec docs/specs/M5-sgf-import.md §5, AC 20). All file I/O lives here;
// the logic is pure in src/sgf/. Run with `npm run import:sgf` (scripts/import-sgf.run.ts).
//
//   content-src/u10-example.src.json   hand-authored lesson; sequence exercises use "sgf": "e1.sgf"
//   content-src/u10-example/e1.sgf     SGF files, next to the source, in a folder named after it
//        -> src/lessons/content/u10-example.json   generated (never hand-edited), Prettier-formatted
//
// A lesson with any error is not written. Errors and warnings are printed as
//   path/e1.sgf:1:34 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, relative, sep } from 'node:path';

import { validateLesson, type Language } from '@/lessons';
import { expandLessonSource, type LessonSource, type SgfIssue } from '@/sgf';

export const REPO_ROOT = join(__dirname, '..');
export const SRC_SUFFIX = '.src.json';

export interface ImportOptions {
  /** Folder with the `*.src.json` files. */
  srcDir: string;
  /** Folder the lesson JSON is written to. */
  outDir: string;
  /** Text check for the validator (default: every key exists). */
  hasText?: (key: string, lang: Language) => boolean;
  /** Paths in messages and `generatedFrom` are relative to this (default: the repo root). */
  root?: string;
}

export interface ImportReport {
  /** Files written, relative to `root`. */
  written: string[];
  errors: string[];
  warnings: string[];
}

export type BuildResult =
  | { ok: true; id: string; lesson: Record<string, unknown>; warnings: string[] }
  | { ok: false; errors: string[] };

function posix(path: string): string {
  return path.split(sep).join('/');
}

function issueLine(level: 'error' | 'warning', file: string, issue: SgfIssue): string {
  return `${file}:${issue.line}:${issue.col} ${level} ${issue.code}: ${issue.message}`;
}

/** The `.src.json` files of `srcDir`, sorted; [] when the folder does not exist. */
export function lessonSources(srcDir: string): string[] {
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir)
    .filter((name) => name.endsWith(SRC_SUFFIX))
    .sort()
    .map((name) => join(srcDir, name));
}

/** Expands and validates one `.src.json` (no writing). */
export function buildLesson(
  srcFile: string,
  opts: Omit<ImportOptions, 'srcDir' | 'outDir'>,
): BuildResult {
  const root = opts.root ?? REPO_ROOT;
  const shown = posix(relative(root, srcFile));
  const name = basename(srcFile, SRC_SUFFIX);
  const sgfDir = join(srcFile, '..', name);
  const fail = (code: string, message: string): BuildResult => ({
    ok: false,
    errors: [`${shown}:1:1 error ${code}: ${message}`],
  });

  let src: unknown;
  try {
    src = JSON.parse(readFileSync(srcFile, 'utf8'));
  } catch (error) {
    return fail('SRC_BAD_JSON', error instanceof Error ? error.message : String(error));
  }
  if (typeof src !== 'object' || src === null || Array.isArray(src)) {
    return fail('SRC_BAD_JSON', 'a lesson source must be a JSON object');
  }
  if ((src as LessonSource).id !== name) {
    return fail(
      'SRC_BAD_NAME',
      `the file must be named after the lesson id ("${String((src as LessonSource).id)}${SRC_SUFFIX}")`,
    );
  }

  const readSgf = (path: string) => {
    if (isAbsolute(path) || normalize(path).startsWith('..')) {
      throw new Error(`"${path}" must be a file inside ${posix(relative(root, sgfDir))}/`);
    }
    return readFileSync(join(sgfDir, path), 'utf8');
  };
  const expanded = expandLessonSource(src as LessonSource, readSgf);
  const sgfShown = (issue: SgfIssue) =>
    issue.file === undefined ? shown : posix(relative(root, join(sgfDir, issue.file)));
  if (!expanded.ok) {
    return { ok: false, errors: expanded.errors.map((e) => issueLine('error', sgfShown(e), e)) };
  }
  const warnings = expanded.warnings.map((w) => issueLine('warning', sgfShown(w), w));

  const { schema, ...rest } = expanded.lesson as Record<string, unknown>;
  const lesson = { schema, generatedFrom: shown, ...rest };
  const validation = validateLesson(lesson, { hasText: opts.hasText ?? (() => true) });
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map(
        (e) => `${shown}:1:1 error ${e.code}: ${e.path === '' ? '' : `${e.path}: `}${e.message}`,
      ),
    };
  }
  return { ok: true, id: name, lesson, warnings };
}

/** Formats lesson JSON exactly as `prettier --write` would (the repo's .prettierrc). */
export function formatLessonJson(lesson: unknown, id: string): string {
  const prettier = require.resolve('prettier/bin/prettier.cjs');
  // A path inside the repo, so Prettier finds the project config wherever the file is written.
  const asIfAt = join(REPO_ROOT, 'src', 'lessons', 'content', `${id}.json`);
  return execFileSync(process.execPath, [prettier, '--stdin-filepath', asIfAt], {
    input: JSON.stringify(lesson),
    encoding: 'utf8',
  });
}

/** Converts every `.src.json` of `srcDir`; writes only lessons without errors. */
export function importLessons(opts: ImportOptions): ImportReport {
  const root = opts.root ?? REPO_ROOT;
  const report: ImportReport = { written: [], errors: [], warnings: [] };
  for (const srcFile of lessonSources(opts.srcDir)) {
    const result = buildLesson(srcFile, opts);
    if (!result.ok) {
      report.errors.push(...result.errors);
      continue;
    }
    report.warnings.push(...result.warnings);
    const outFile = join(opts.outDir, `${result.id}.json`);
    writeFileSync(outFile, formatLessonJson(result.lesson, result.id));
    report.written.push(posix(relative(root, outFile)));
  }
  return report;
}
