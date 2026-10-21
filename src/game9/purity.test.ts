// src/game9 logic is pure TS (spec M6 §5: "screens only render"): no React, timers or clock.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(__dirname).filter((n) => /\.ts$/.test(n) && !/\.test\.ts$/.test(n));

describe('src/game9 purity', () => {
  it('finds the sources', () => expect(files.length).toBeGreaterThanOrEqual(3));

  it.each(files)('%s imports no React / RN / Expo and uses no timers or clock', (file) => {
    const code = readFileSync(join(__dirname, file), 'utf8');
    expect(code).not.toMatch(/from ['"](react|react-native|expo[^'"]*)['"]/);
    expect(code).not.toMatch(/\bsetTimeout\b|\bDate\b|\bMath\.random\b/);
  });
});
