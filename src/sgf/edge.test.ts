// QA edge cases for the SGF parser/converter (spec M5-sgf-import AC 2, 4, 8, 12, 16, 23).
import { createGame, play } from '@/engine';

import { convertSgf, sgfPoint } from './convert';
import { parseSgf } from './parse';
import { sgfPoints } from './points';

function conv(text: string) {
  const parsed = parseSgf(text);
  if (!parsed.ok) return { parseErrors: parsed.errors };
  return convertSgf(parsed.tree);
}

describe('QA: parser edge cases', () => {
  it('escaped bracket and backslash inside C do not end the value', () => {
    const r = parseSgf('(;SZ[5]C[a \\] b\\\\c]AB[bc])');
    expect(r.ok).toBe(true);
  });
  it('an escaped bracket right before the closing one is not unterminated', () => {
    expect(parseSgf('(;C[a\\]])').ok).toBe(true);
    const bad = parseSgf('(;C[a\\])');
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(bad.errors[0]).toMatchObject({ code: 'SGF_UNTERMINATED_VALUE', line: 1, col: 4 });
  });
  it('CRLF line endings: error line numbers still right', () => {
    const r = parseSgf('(;SZ[5]\r\nAB[bc]\r\nC[x');
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors[0]).toMatchObject({ code: 'SGF_UNTERMINATED_VALUE', line: 3, col: 2 });
  });
  it('multiple values with newlines between them parse', () => {
    const c = conv('(;GM[1]SZ[5]\nAB[bc]\n[dc]\n[cb]\nAW[cc]\n;B[cd])');
    expect('problem' in c && c.ok).toBe(true);
  });
  it('compressed range, single row and column', () => {
    expect(sgfPoints('aa:ac', 5)).toHaveLength(3);
    expect(sgfPoints('aa:ea', 5)).toHaveLength(5);
    expect(sgfPoints('aa:ee', 5)).toHaveLength(25);
    expect(sgfPoints('aa:ff', 5)).toBeNull();
    expect(sgfPoints('cc:aa', 5)).toBeNull();
  });
  it('an unclosed paren after a long chain reports the opening paren on its line', () => {
    const r = parseSgf('\n\n  (;SZ[5];B[aa]');
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors[0]).toMatchObject({ code: 'SGF_UNBALANCED_PARENS', line: 3, col: 3 });
  });
});

describe('QA: coordinates in all four corners', () => {
  it.each([5, 7, 9])('size %i corners', (n) => {
    const cols = 'abcdefghjklmnopqrst'; // the engine skips the letter i
    const last = String.fromCharCode(96 + n);
    const lastCol = cols[n - 1];
    const top = String(n);
    expect(sgfPoint('aa', n)).toBe(`a${top}`);
    expect(sgfPoint(`${last}a`, n)).toBe(`${lastCol}${top}`);
    expect(sgfPoint(`a${last}`, n)).toBe('a1');
    expect(sgfPoint(`${last}${last}`, n)).toBe(`${lastCol}1`);
  });
  it.each([5, 7, 9])('size %i: one past the edge is null', (n) => {
    const past = String.fromCharCode(97 + n);
    expect(sgfPoint(`${past}a`, n)).toBeNull();
    expect(sgfPoint(`a${past}`, n)).toBeNull();
  });
});

describe('QA: converted lines replay in the engine', () => {
  it('a wrong branch that is illegal when replayed is flagged by the validator-facing engine', () => {
    // wrong move onto an occupied point
    const c = conv('(;GM[1]SZ[5]PL[B]AB[bc][dc][cb]AW[cc](;B[cd])(;B[cc]))');
    if (!('problem' in c) || !c.ok) throw new Error('should convert');
    const wrong = c.problem.wrong[0].line[0];
    const game = createGame(c.problem.size, { setup: c.problem.setup, toPlay: c.problem.toPlay });
    expect(play(game, wrong.at).ok).toBe(false);
  });
});
