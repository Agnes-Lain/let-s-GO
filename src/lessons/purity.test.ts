/** AC 29: src/lessons is pure TS (engine only); registry.ts may import JSON. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('src/lessons purity (AC 29)', () => {
  const files = sources(__dirname);

  it('finds the sources', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => relative(__dirname, f)))('%s imports no React / RN / Expo', (file) => {
    const code = readFileSync(join(__dirname, file), 'utf8');
    const imports = [...code.matchAll(/from ['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g)].map(
      (m) => m[1] ?? m[2],
    );
    const forbidden = imports.filter((m) => /^(react|react-native|expo|@expo\/)/.test(m));
    expect(forbidden).toEqual([]);
  });

  it('only the registry imports JSON', () => {
    for (const file of files) {
      if (file.endsWith('registry.ts') || file.includes('__fixtures__')) continue;
      expect({ file, json: /from ['"][^'"]+\.json['"]/.test(readFileSync(file, 'utf8')) }).toEqual({
        file,
        json: false,
      });
    }
  });
});
