// `npm run import:sgf` (spec docs/specs/M5-sgf-import.md AC 20): content-src/*.src.json ->
// src/lessons/content/<id>.json. Runs under Jest for the `@/` paths and TS (same pattern as
// `npm run tune:bot`), with its own config: it is NOT part of `npm test`. Fails (exit 1) on any
// error; warnings are printed and do not fail.
//
// After importing, add the lesson to src/lessons/registry.ts like any other lesson.

import { join } from 'node:path';

import { hasTextIn } from '@/lessons/loader';
import { LESSON_TEXTS } from '@/lessons/registry';

import { REPO_ROOT, importLessons } from './import-sgf';

it('imports content-src/*.src.json', () => {
  const report = importLessons({
    srcDir: join(REPO_ROOT, 'content-src'),
    outDir: join(REPO_ROOT, 'src', 'lessons', 'content'),
    hasText: hasTextIn(LESSON_TEXTS),
  });
  const lines = [
    ...report.warnings,
    ...report.errors,
    ...report.written.map((file) => `wrote ${file}`),
    `${report.written.length} lesson(s) written, ${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  if (report.errors.length > 0)
    throw new Error(`import:sgf failed with ${report.errors.length} error(s)`);
});
