/** AC 1: src/bot imports only @/engine and itself; no React/RN/Expo, randomness, clock or timers. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__fixtures__' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('src/bot purity (AC 1)', () => {
  const files = sources(__dirname);

  it('finds the sources', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files.map((f) => relative(__dirname, f)))('%s imports only @/engine and ./', (file) => {
    const code = readFileSync(join(__dirname, file), 'utf8');
    const imports = [...code.matchAll(/from ['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g)].map(
      (m) => m[1] ?? m[2],
    );
    expect(imports.filter((m) => m !== '@/engine' && !m.startsWith('./'))).toEqual([]);
  });

  it.each(files.map((f) => relative(__dirname, f)))(
    '%s uses no randomness, clock, timers or I/O',
    (file) => {
      const code = readFileSync(join(__dirname, file), 'utf8');
      const forbidden = [
        /\bMath\.random\b/,
        /\bDate\b/,
        /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/,
        /\bperformance\.now\b/,
        /\bfetch\(|\bconsole\./,
      ];
      for (const pattern of forbidden) {
        expect({ file, match: pattern.exec(code)?.[0] ?? null }).toEqual({ file, match: null });
      }
    },
  );
});
