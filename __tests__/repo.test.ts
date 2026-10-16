/**
 * @jest-environment node
 *
 * Repository structure and tooling checks for M0 (docs/specs/M0-project-setup.md).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readJson = (path: string) => JSON.parse(read(path));

function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('tooling (AC2, AC3, AC5)', () => {
  const pkg = readJson('package.json');

  it('pins Node 24 for CI and allows the Expo-supported LTS lines locally (AC2)', () => {
    expect(read('.nvmrc').trim()).toBe('24');
    expect(pkg.engines.node).toBe('^22.13.0 || ^24.3.0');
  });

  it('defines the required npm scripts (AC3)', () => {
    expect(pkg.scripts).toMatchObject({
      start: 'expo start',
      web: 'expo start --web',
      lint: 'eslint . --max-warnings 0',
      typecheck: 'tsc --noEmit',
      test: 'jest',
      format: 'prettier --write .',
      'format:check': 'prettier --check .',
    });
  });

  it('uses strict TypeScript on the Expo base with the @/* alias (AC5)', () => {
    const tsconfig = readJson('tsconfig.json');
    expect(tsconfig.extends).toBe('expo/tsconfig.base');
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
  });

  it('commits package-lock.json (AC1)', () => {
    expect(existsSync(join(root, 'package-lock.json'))).toBe(true);
  });
});

describe('folder layout (AC7)', () => {
  it.each([
    ['src/exercises/index.ts', 'M3'],
    ['src/store/index.ts', 'M3'],
    ['src/bot/index.ts', 'M4'],
  ])('%s is a placeholder for %s', (path, milestone) => {
    const lines = read(path).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\/\/ /);
    expect(lines[0]).toContain(milestone);
    expect(lines[1]).toBe('export {};');
  });

  it.each([
    'src/engine/index.ts', // filled in M1 (no longer a placeholder)
    'src/i18n/index.ts',
    'src/i18n/zh-CN.json',
    'src/i18n/en.json',
    'src/i18n/fr.json',
    'src/theme/tokens.ts',
    'src/theme/Landscape.tsx',
    'app/_layout.tsx',
    'app/index.tsx',
    'app/settings.tsx',
    'app/lesson/[id].tsx',
    'app/practice/[id].tsx',
    'app/+not-found.tsx',
  ])('%s exists', (path) => {
    expect(existsSync(join(root, path))).toBe(true);
  });

  it('has the lesson schema (M3)', () => {
    expect(existsSync(join(root, 'src/lessons/schema.ts'))).toBe(true);
  });

  it('keeps only routes in app/ (no tests or helpers that expo-router would turn into routes)', () => {
    for (const file of filesUnder('app')) {
      expect(file).not.toMatch(/\.test\.|__tests__/);
    }
  });
});

describe('no hard-coded user-facing strings in app/ (AC8)', () => {
  const screens = filesUnder('app').filter((f) => f.endsWith('.tsx'));

  it.each(screens)('%s has no CJK text', (file) => {
    expect(read(file)).not.toMatch(/[　-〿㐀-鿿＀-￯]/);
  });

  it.each(screens)('%s has no literal JSX text', (file) => {
    // Text between JSX tags that is not an expression, e.g. <Text>Hello</Text>.
    const literalText = read(file).match(/>\s*[^\s<>{}()=;,][^<>{}]*</g) ?? [];
    expect(literalText).toEqual([]);
  });
});

describe('CI workflow (AC29)', () => {
  const ci = read('.github/workflows/ci.yml');

  it('runs on pull requests and on pushes to master', () => {
    expect(ci).toMatch(/on:\s*\n\s+pull_request:/);
    expect(ci).toMatch(/push:\s*\n\s+branches:\s*\[master\]/);
    expect(ci).toContain('runs-on: ubuntu-latest');
  });

  it('sets up Node from .nvmrc with the npm cache', () => {
    expect(ci).toContain('uses: actions/setup-node@');
    expect(ci).toContain('node-version-file: .nvmrc');
    expect(ci).toContain('cache: npm');
  });

  it('runs install, lint, typecheck, format check and tests as separate named steps in order', () => {
    const commands = [
      'npm ci',
      'npm run lint',
      'npm run typecheck',
      'npm run format:check',
      'npm test -- --ci',
    ];
    const positions = commands.map((command) => ci.indexOf(`run: ${command}`));
    positions.forEach((position) => expect(position).toBeGreaterThan(-1));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(ci.match(/- name: /g)?.length).toBeGreaterThanOrEqual(commands.length);
  });
});

describe('engine and bot stay pure (AC6)', () => {
  function lint(filename: string, source: string) {
    const result = spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/eslint/bin/eslint.js'),
        '--stdin',
        '--stdin-filename',
        filename,
        '--format',
        'json',
      ],
      { cwd: root, input: source, encoding: 'utf8' },
    );
    const [report] = JSON.parse(result.stdout) as { messages: { ruleId: string | null }[] }[];
    return report.messages.map((m) => m.ruleId);
  }

  it.each([
    ['src/engine/check.ts', "import { useState } from 'react';\nexport const x = useState;\n"],
    ['src/engine/check.ts', "import { View } from 'react-native';\nexport const x = View;\n"],
    [
      'src/bot/check.ts',
      "import { getLocales } from 'expo-localization';\nexport const x = getLocales;\n",
    ],
    ['src/bot/check.ts', "import Constants from 'expo-constants';\nexport const x = Constants;\n"],
    ['src/engine/check.ts', "import { Link } from 'expo-router';\nexport const x = Link;\n"],
    ['src/engine/check.ts', "import * as Expo from 'expo';\nexport const x = Expo;\n"],
  ])('%s: rejects %j', (filename, source) => {
    expect(lint(filename, source)).toContain('no-restricted-imports');
  });

  it('allows the same imports outside src/engine and src/bot', () => {
    const source = "import { View } from 'react-native';\nexport const x = View;\n";
    expect(lint('src/board/check.ts', source)).not.toContain('no-restricted-imports');
  });

  it('allows plain TypeScript imports inside src/engine', () => {
    expect(
      lint(
        'src/engine/check.ts',
        "import * as engine from './index';\nexport const api = engine;\n",
      ),
    ).not.toContain('no-restricted-imports');
  });
});
