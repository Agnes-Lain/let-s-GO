import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';

const root = join(__dirname, '..', '..');
const boardDir = join(root, 'src', 'board');
const boardFiles = readdirSync(boardDir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
const read = (p: string) => readFileSync(p, 'utf8');

describe('M2 quality (AC62, AC63)', () => {
  it('geometry.ts imports no React / React Native', () => {
    expect(read(join(boardDir, 'geometry.ts'))).not.toMatch(/from 'react|from "react|react-native/);
  });

  it('no file in src/board calls play, checkMove or legalMoves', () => {
    for (const f of boardFiles) {
      expect({
        f,
        // Engine move functions called directly; method calls such as `player.play()` are not engine calls.
        hit: /(?<![.\w])(play|checkMove|legalMoves)\s*\(/.test(read(join(boardDir, f))),
      }).toEqual({
        f,
        hit: false,
      });
    }
  });

  it('zh-CN, en and fr have identical key sets', () => {
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(en)).toEqual(keys(zhCN));
    expect(keys(fr)).toEqual(keys(zhCN));
  });

  it('every board.* / dev.board.* value is non-empty', () => {
    for (const k of Object.keys(en).filter((k) => /^(board|dev\.board)\./.test(k))) {
      for (const dict of [en, fr, zhCN] as Record<string, string>[]) {
        expect({ k, ok: dict[k].trim().length > 0 }).toEqual({ k, ok: true });
      }
    }
  });

  it('app/dev/board.tsx and src/board have no hard-coded JSX text', () => {
    const files = [join(root, 'app', 'dev', 'board.tsx'), join(boardDir, 'GoBoard.tsx')];
    for (const f of files) {
      const jsxText = [...read(f).matchAll(/(?<![=-])>\s*([A-Za-z一-鿿][^<>{}]*?)\s*</g)].map(
        (m) => m[1],
      );
      expect({ f, jsxText }).toEqual({ f, jsxText: [] });
    }
  });
});
