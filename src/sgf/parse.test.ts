// SGF parser (spec docs/specs/M5-sgf-import.md §8, AC 1–9).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSgf } from './parse';
import { sgfPoints } from './points';
import type { SgfIssue, SgfNode } from './types';

const FIXTURES = join(__dirname, '..', '..', '__tests__', 'fixtures', 'sgf');
const F1 = readFileSync(join(FIXTURES, 'f1-capture-in-one.sgf'), 'utf8');

function tree(text: string): SgfNode {
  const result = parseSgf(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.tree;
}

function errors(text: string): SgfIssue[] {
  const result = parseSgf(text);
  if (result.ok) throw new Error('expected a parse error');
  return result.errors;
}

/** The values of property `id` in `node`, or undefined. */
function prop(node: SgfNode, id: string): string[] | undefined {
  return node.props.find((p) => p.id === id)?.values.map((v) => v.text);
}

describe('parseSgf: structure (AC 1, 3)', () => {
  it('AC 1: F1 has the setup in the root and two one-move children', () => {
    const root = tree(F1);
    expect(prop(root, 'SZ')).toEqual(['5']);
    expect(prop(root, 'AB')).toEqual(['bc', 'dc', 'cb']);
    expect(prop(root, 'AW')).toEqual(['cc']);
    expect(root.children).toHaveLength(2);
    for (const child of root.children) {
      expect(child.props.map((p) => p.id)).toEqual(['B']);
    }
    expect(prop(root.children[0], 'B')).toEqual(['cd']);
    expect(prop(root.children[1], 'B')).toEqual(['ae']);
  });

  it('a sequence of nodes becomes a chain of first children', () => {
    const root = tree('(;SZ[5];B[aa];W[bb])');
    expect(prop(root.children[0], 'B')).toEqual(['aa']);
    expect(prop(root.children[0].children[0], 'W')).toEqual(['bb']);
  });

  it('AC 3: whitespace and newlines between nodes and properties are fine', () => {
    const root = tree('  (\n ;  FF[4]\n\tSZ [5]  AB [aa]\r\n  [bb]\n (\n;B[cc] )\n)\n');
    expect(prop(root, 'FF')).toEqual(['4']);
    expect(prop(root, 'AB')).toEqual(['aa', 'bb']);
    expect(prop(root.children[0], 'B')).toEqual(['cc']);
  });

  it('AC 3: legacy lower-case letters in an identifier are dropped', () => {
    const root = tree('(;SZ[5]Ab[aa]AddBlack[bb]AddWhite[cc])');
    expect(prop(root, 'A')).toEqual(['aa']);
    expect(prop(root, 'AB')).toEqual(['bb']);
    expect(prop(root, 'AW')).toEqual(['cc']);
  });

  it('an identifier with no capital letter is SGF_SYNTAX', () => {
    expect(parseSgf('(;SZ[5]ab[aa])')).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: 'SGF_SYNTAX', line: 1, col: 8 })],
    });
  });

  it('keeps the position of nodes, properties and values', () => {
    const root = tree('(;SZ[5]\n AB[aa])');
    expect(root).toMatchObject({ line: 1, col: 2 });
    const ab = root.props[1];
    expect(ab).toMatchObject({ id: 'AB', line: 2, col: 2 });
    expect(ab.values[0]).toMatchObject({ text: 'aa', line: 2, col: 4 });
  });

  it('accepts a byte-order mark', () => {
    expect(prop(tree('﻿(;SZ[5])'), 'SZ')).toEqual(['5']);
  });
});

describe('parseSgf: values (AC 2)', () => {
  it('unescapes \\] and \\\\', () => {
    expect(prop(tree('(;C[a \\] b\\\\c])'), 'C')).toEqual(['a ] b\\c']);
  });

  it('removes a soft line break (backslash + newline)', () => {
    expect(prop(tree('(;C[one\\\ntwo])'), 'C')).toEqual(['onetwo']);
    expect(prop(tree('(;C[one\\\r\ntwo])'), 'C')).toEqual(['onetwo']);
  });

  it('keeps hard line breaks and non-ASCII text', () => {
    expect(prop(tree('(;C[黑先\n活])'), 'C')).toEqual(['黑先\n活']);
  });

  it('an empty value is an empty string', () => {
    expect(prop(tree('(;SZ[5];B[])').children[0], 'B')).toEqual(['']);
  });
});

describe('sgfPoints: compressed point lists (AC 4)', () => {
  it('AB[aa:cc] is the 9 points of the rectangle', () => {
    expect(sgfPoints('aa:cc', 5)?.sort()).toEqual(
      ['aa', 'ab', 'ac', 'ba', 'bb', 'bc', 'ca', 'cb', 'cc'].sort(),
    );
  });

  it('a single point is itself', () => {
    expect(sgfPoints('cd', 5)).toEqual(['cd']);
  });

  it.each([['cc:aa'], ['aa:ff'], ['zz'], ['a'], ['aa:'], ['']])(
    '"%s" on 5×5 is not a point list',
    (value) => {
      expect(sgfPoints(value, 5)).toBeNull();
    },
  );
});

describe('parseSgf: errors (AC 5–9)', () => {
  it.each([[''], ['   '], ['\n\t\n']])('AC 5: empty input %j is SGF_EMPTY at 1:1', (text) => {
    expect(errors(text)).toEqual([expect.objectContaining({ code: 'SGF_EMPTY', line: 1, col: 1 })]);
  });

  it('AC 6: a missing ")" points at the unmatched "("', () => {
    expect(errors('(;SZ[5]AB[bc]')).toEqual([
      expect.objectContaining({ code: 'SGF_UNBALANCED_PARENS', line: 1, col: 1 }),
    ]);
    expect(errors('(;SZ[5]\n(;B[aa]\n(;W[bb])')).toEqual([
      expect.objectContaining({ code: 'SGF_UNBALANCED_PARENS', line: 2, col: 1 }),
    ]);
  });

  it('AC 6: an extra ")" is SGF_UNBALANCED_PARENS at it', () => {
    expect(errors('(;SZ[5]))')).toEqual([
      expect.objectContaining({ code: 'SGF_UNBALANCED_PARENS', line: 1, col: 9 }),
    ]);
  });

  it('AC 6: a value without "]" is SGF_UNTERMINATED_VALUE at its "["', () => {
    expect(errors('(;SZ[5]AB[bc')).toEqual([
      expect.objectContaining({ code: 'SGF_UNTERMINATED_VALUE', line: 1, col: 10 }),
    ]);
    expect(errors('(;SZ[5]C[a\\]')).toEqual([
      expect.objectContaining({ code: 'SGF_UNTERMINATED_VALUE', line: 1, col: 9 }),
    ]);
  });

  it('AC 7: two game trees is SGF_MULTIPLE_GAMES at the second', () => {
    expect(errors('(;SZ[5])\n  (;SZ[5])')).toEqual([
      expect.objectContaining({ code: 'SGF_MULTIPLE_GAMES', line: 2, col: 3 }),
    ]);
  });

  it('AC 8: a multi-line file reports the right line and column', () => {
    const text = '(;GM[1]FF[4]\nSZ[5]\nAB[aa] ]\n)';
    expect(errors(text)).toEqual([
      expect.objectContaining({ code: 'SGF_SYNTAX', line: 3, col: 8 }),
    ]);
  });

  it('AC 8: columns count characters, not bytes', () => {
    expect(errors('(;C[黑先]5)')).toEqual([
      expect.objectContaining({ code: 'SGF_SYNTAX', line: 1, col: 8 }),
    ]);
  });

  it.each([
    ['hello', 1, 1],
    ['(SZ[5])', 1, 2],
    ['(;SZ)', 1, 5],
    ['(;SZ[5]5[x])', 1, 8],
    ['()', 1, 2],
    ['(;SZ[5](;B[aa]);W[bb])', 1, 16],
    ['(;SZ[5]) junk', 1, 10],
  ])('AC 9: %j is SGF_SYNTAX at %i:%i', (text, line, col) => {
    expect(errors(text)).toEqual([expect.objectContaining({ code: 'SGF_SYNTAX', line, col })]);
  });

  it('AC 8: every error has a 1-based line and column and a message', () => {
    for (const text of ['', 'x', '(;', '(;A[', '(;SZ[5])(;SZ[5])', ')']) {
      for (const error of errors(text)) {
        expect(error.line).toBeGreaterThanOrEqual(1);
        expect(error.col).toBeGreaterThanOrEqual(1);
        expect(error.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('AC 9: 1 MB of random text gives an error quickly and never throws', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const alphabet = '();[]\\:ABCWabcdz \n';
    const chunks: string[] = [];
    for (let i = 0; i < 1_000_000; i++)
      chunks.push(alphabet[Math.floor(random() * alphabet.length)]);
    const inputs = [chunks.join(''), `(${chunks.join('')}`, '('.repeat(1_000_000)];
    const start = Date.now();
    for (const text of inputs) {
      const result = parseSgf(text);
      expect(result.ok).toBe(false);
    }
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
