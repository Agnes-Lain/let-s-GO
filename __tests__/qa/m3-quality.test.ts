/**
 * M3 quality checks (spec ACs 58, 96): no hard-coded user-facing text in the lesson and practice
 * UI, engine moves only through src/lessons/goals.ts and src/exercises/engineAdapter.ts, and a
 * rule-free <GoBoard>.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

const root = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) {
      return name === '__fixtures__' ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const read = (path: string) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ui = [...sources('src/exercises'), 'app/lesson/[id].tsx', 'app/practice/[id].tsx'];

/** Non-blank JSX text (e.g. <Text>Hello</Text>), found with the TypeScript parser. */
function jsxText(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && node.text.trim() !== '') found.push(node.text.trim());
    if (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent)) {
      const name = node.parent.name.getText(source);
      if (/^(accessibilityLabel|accessibilityHint|label|title)$/.test(name)) found.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('no hard-coded user-facing strings (AC 58, 96)', () => {
  it.each(ui.filter((f) => f.endsWith('.tsx')))('%s: no literal JSX text or labels', (file) => {
    expect(jsxText(file)).toEqual([]);
  });

  it.each(ui)('%s: no CJK text in code', (file) => {
    expect(read(file)).not.toMatch(/[一-鿿　-〿＀-￯]/);
  });
});

describe('engine moves stay in two files (AC 96)', () => {
  const allowed = ['src/lessons/goals.ts', 'src/exercises/engineAdapter.ts'];
  const files = [...ui, ...sources('src/lessons')].filter((f) => !allowed.includes(f));

  it.each(files)('%s does not play moves', (file) => {
    const imports = [...read(file).matchAll(/import\s*{([^}]*)}\s*from\s*'@\/engine'/g)]
      .flatMap((m) => m[1].split(','))
      .map((name) => name.trim().replace(/^type\s+/, ''));
    expect(imports.filter((name) => ['play', 'checkMove', 'legalMoves'].includes(name))).toEqual(
      [],
    );
  });

  it('<GoBoard> stays rule-free', () => {
    for (const file of sources('src/board').filter((f) => !f.includes('scenarios'))) {
      const rules = /(?<![.\w])(play|checkMove|legalMoves)\(/.test(read(file));
      expect({ file, rules }).toEqual({ file, rules: false });
    }
  });
});
