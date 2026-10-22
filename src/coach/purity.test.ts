// src/coach is pure TS (spec docs/specs/M6-game-coaching.md §3): it imports only the engine, the
// bot and itself, and uses no React / RN / Expo, randomness, clock, timers or I/O.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(__dirname).filter((n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n));

describe('src/coach purity', () => {
  it('finds the sources', () => expect(files.length).toBeGreaterThanOrEqual(3));

  it.each(files)('%s imports only @/engine, @/bot and ./', (file) => {
    const code = readFileSync(join(__dirname, file), 'utf8');
    const imports = [...code.matchAll(/from ['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g)].map(
      (m) => m[1] ?? m[2],
    );
    expect(imports.filter((m) => m !== '@/engine' && m !== '@/bot' && !m.startsWith('./'))).toEqual(
      [],
    );
  });

  it.each(files)('%s uses no randomness, clock, timers or I/O', (file) => {
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
  });
});
