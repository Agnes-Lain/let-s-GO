// SGF -> problem converter (spec docs/specs/M5-sgf-import.md §7–8, AC 10–18).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createGame, parseBoard, parseVertex, play, toVertex, type GameState } from '@/engine';

import { convertSgf, sgfPoint } from './convert';
import { parseSgf } from './parse';
import type { SgfIssue, SgfProblem } from './types';

const FIXTURES = join(__dirname, '..', '..', '__tests__', 'fixtures', 'sgf');
const F1 = readFileSync(join(FIXTURES, 'f1-capture-in-one.sgf'), 'utf8');
const F2 = readFileSync(join(FIXTURES, 'f2-ladder.sgf'), 'utf8');

function convert(text: string) {
  const parsed = parseSgf(text);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return convertSgf(parsed.tree);
}

function problem(text: string): SgfProblem {
  const result = convert(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.problem;
}

function errors(text: string): SgfIssue[] {
  const result = convert(text);
  if (result.ok) throw new Error('expected a conversion error');
  return result.errors;
}

function codes(text: string): string[] {
  return errors(text).map((e) => e.code);
}

/** The starting position of a problem as the engine sees it. */
function start(p: SgfProblem): GameState {
  return createGame(p.size, { setup: p.setup, toPlay: p.toPlay });
}

/** Stones of `board` in the setup notation, sorted like the engine (column, then row). */
function stonesOf(ascii: string) {
  const { board } = parseBoard(ascii);
  const out: { B: string[]; W: string[] } = { B: [], W: [] };
  for (let x = 0; x < board.size; x++) {
    for (let y = 0; y < board.size; y++) {
      const cell = board.cells[y * board.size + x];
      if (cell) out[cell].push(toVertex({ x, y }, board.size));
    }
  }
  return out;
}

describe('convertSgf: F1 capture in one (AC 10)', () => {
  // 5 . . . . .
  // 4 . . X . .
  // 3 . X O X .
  // 2 . . * . .      * = c2, the correct move
  // 1 . . . . .
  //   a b c d e
  const BOARD = `
    . . . . .
    . . X . .
    . X O X .
    . . . . .
    . . . . .
  `;

  it('gives size, sorted setup, side to play, line and wrong branch', () => {
    expect(problem(F1)).toEqual({
      size: 5,
      setup: { B: ['b3', 'c4', 'd3'], W: ['c3'] },
      toPlay: 'B',
      line: [{ color: 'B', at: 'c2' }],
      wrong: [{ line: [{ color: 'B', at: 'a1' }] }],
    });
  });

  it('the setup is the drawn board, and the correct move captures c3', () => {
    const p = problem(F1);
    expect(p.setup).toEqual(stonesOf(BOARD));
    const result = play(start(p), p.line[0].at);
    expect(result.ok && result.facts.captured).toEqual([[parseVertex('c3', 5)]]);
  });

  it('the wrong move is legal and captures nothing', () => {
    const p = problem(F1);
    const result = play(start(p), p.wrong[0].line[0].at);
    expect(result.ok && result.facts.captured).toEqual([]);
  });
});

describe('convertSgf: F2 ladder (AC 11)', () => {
  // 5 . . . . .
  // 4 . . . . .
  // 3 . X O . .
  // 2 . . X X .
  // 1 . . . . .
  //   a b c d e
  const BOARD = `
    . . . . .
    . . . . .
    . X O . .
    . . X X .
    . . . . .
  `;

  it('gives the 7-move line and the wrong branch with its refutation', () => {
    const p = problem(F2);
    expect(p.setup).toEqual(stonesOf(BOARD));
    expect(p.line.map((m) => m.at)).toEqual(['c4', 'd3', 'e3', 'd4', 'd5', 'e4', 'e5']);
    expect(p.line.map((m) => m.color)).toEqual(['B', 'W', 'B', 'W', 'B', 'W', 'B']);
    expect(p.wrong).toEqual([
      {
        line: [
          { color: 'B', at: 'd3' },
          { color: 'W', at: 'c4' },
        ],
      },
    ]);
  });

  it('every move is legal and the last one captures the four white stones', () => {
    const p = problem(F2);
    let state = start(p);
    let captured: string[] = [];
    for (const move of p.line) {
      const result = play(state, move.at);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      captured = result.facts.captured.flat().map((pt) => toVertex(pt, 5));
    }
    expect(captured.sort()).toEqual(['c3', 'd3', 'd4', 'e4']);
  });
});

describe('sgfPoint: coordinates (AC 12)', () => {
  it.each([
    ['aa', 5, 'a5'],
    ['ee', 5, 'e1'],
    ['cc', 5, 'c3'],
    ['bc', 5, 'b3'],
    ['cb', 5, 'c4'],
    ['cd', 5, 'c2'],
    ['gg', 7, 'g1'],
    ['aa', 9, 'a9'],
    ['ai', 9, 'a1'],
    ['hh', 9, 'h2'],
    ['ii', 9, 'j1'],
  ])('%s on %i×%i is %s', (xy, size, vertex) => {
    expect(sgfPoint(xy, size)).toBe(vertex);
  });

  it.each([['ff'], ['za'], ['a'], ['abc'], [''], ['tt'], ['AA']])('%j on 5×5 is null', (xy) => {
    expect(sgfPoint(xy, 5)).toBeNull();
  });

  it('all 81 points of 9×9 round-trip with the engine', () => {
    const letters = 'abcdefghi';
    const seen = new Set<string>();
    for (const sx of letters) {
      for (const sy of letters) {
        const vertex = sgfPoint(sx + sy, 9);
        expect(vertex).not.toBeNull();
        const point = parseVertex(vertex!, 9);
        expect(point).toEqual({ x: letters.indexOf(sx), y: 8 - letters.indexOf(sy) });
        expect(toVertex(point, 9)).toBe(vertex);
        seen.add(vertex!);
      }
    }
    expect(seen.size).toBe(81);
  });
});

describe('convertSgf: side to play (AC 13)', () => {
  it('without PL, the colour of the first move', () => {
    expect(problem('(;SZ[5]AB[cc];W[dd])').toPlay).toBe('W');
  });

  it('PL[W] with a first move B is SGF_BAD_PLAYER', () => {
    expect(codes('(;SZ[5]PL[W];B[dd])')).toEqual(['SGF_BAD_PLAYER']);
  });

  it('PL that is not B or W is SGF_BAD_PLAYER', () => {
    expect(codes('(;SZ[5]PL[X];B[dd])')).toEqual(['SGF_BAD_PLAYER']);
  });

  it('a wrong branch of the other colour is SGF_BAD_PLAYER', () => {
    expect(codes('(;SZ[5](;B[dd])(;W[aa]))')).toEqual(['SGF_BAD_PLAYER']);
  });

  it.each([['(;SZ[5]AB[cc])'], ['(;SZ[5]PL[B]AB[cc])'], ['(;SZ[5];C[no move])']])(
    '%s is SGF_NO_MOVES',
    (text) => {
      expect(codes(text)).toEqual(['SGF_NO_MOVES']);
    },
  );
});

describe('convertSgf: board size (AC 14)', () => {
  it.each([['SZ[19]'], ['SZ[4]'], ['SZ[5:7]'], ['SZ[x]'], ['SZ[13]'], ['']])(
    '%j is SGF_BAD_SIZE and names 5, 7, 9',
    (sz) => {
      const [error] = errors(`(;GM[1]${sz};B[aa])`);
      expect(error.code).toBe('SGF_BAD_SIZE');
      expect(error.message).toContain('5, 7 or 9');
    },
  );

  it.each([
    ['SZ[5:5]', 5],
    ['SZ[7]', 7],
    ['SZ[9]', 9],
  ])('%s is accepted', (sz, size) => {
    expect(problem(`(;${sz};B[aa])`).size).toBe(size);
  });

  it('GM other than 1 is SGF_BAD_GAME', () => {
    expect(codes('(;GM[2]SZ[5];B[aa])')).toEqual(['SGF_BAD_GAME']);
  });
});

describe('convertSgf: setup (AC 4, 15)', () => {
  it('AB[aa:cc] expands to a 3×3 block', () => {
    expect(problem('(;SZ[5]AB[aa:cc];W[ee])').setup.B).toEqual([
      'a3',
      'a4',
      'a5',
      'b3',
      'b4',
      'b5',
      'c3',
      'c4',
      'c5',
    ]);
  });

  it('AB[cc:aa] or an off-board point is SGF_BAD_POINT at the value', () => {
    expect(errors('(;SZ[5]AB[cc:aa];W[ee])')).toEqual([
      expect.objectContaining({ code: 'SGF_BAD_POINT', line: 1, col: 10 }),
    ]);
    const [error] = errors('(;SZ[5]AB[aa][zz];W[ee])');
    expect(error).toMatchObject({ code: 'SGF_BAD_POINT', line: 1, col: 14 });
    expect(error.message).toBe('AB[zz] is outside a 5x5 board');
  });

  it.each([
    ['(;SZ[5]AB[bc]AW[bc];B[aa])'],
    ['(;SZ[5]AB[bc][bc];W[aa])'],
    ['(;SZ[5]AB[aa:bb][bb];W[ee])'],
  ])('%s is SGF_SETUP_OVERLAP', (text) => {
    expect(codes(text)).toEqual(['SGF_SETUP_OVERLAP']);
  });

  it('AB in a non-root node is SGF_SETUP_NOT_ROOT', () => {
    expect(codes('(;SZ[5];B[aa];AB[cc]W[bb])')).toEqual(['SGF_SETUP_NOT_ROOT']);
    expect(codes('(;SZ[5];B[aa]PL[W];W[bb])')).toEqual(['SGF_SETUP_NOT_ROOT']);
  });

  it('AE is an error, even in the root', () => {
    expect(codes('(;SZ[5]AB[cc]AE[cc];W[aa])')).toEqual(['SGF_UNSUPPORTED_PROPERTY']);
  });

  it('KO (play an illegal move) is an error', () => {
    expect(codes('(;SZ[5];B[aa]KO[])')).toEqual(['SGF_UNSUPPORTED_PROPERTY']);
  });
});

describe('convertSgf: moves (AC 16)', () => {
  it.each([['(;SZ[5];B[])'], ['(;SZ[5];B[aa];W[tt])']])('%s is SGF_PASS_UNSUPPORTED', (text) => {
    expect(codes(text)).toEqual(['SGF_PASS_UNSUPPORTED']);
  });

  it('two B moves in a row is SGF_NOT_ALTERNATING at the second', () => {
    expect(errors('(;SZ[5];B[aa]\n;B[bb])')).toEqual([
      expect.objectContaining({ code: 'SGF_NOT_ALTERNATING', line: 2, col: 1 }),
    ]);
  });

  it('a node with both B and W is SGF_NOT_ALTERNATING', () => {
    expect(codes('(;SZ[5];B[aa]W[bb])')).toEqual(['SGF_NOT_ALTERNATING']);
  });

  it('a move off the board is SGF_BAD_POINT', () => {
    expect(codes('(;SZ[5];B[ff])')).toEqual(['SGF_BAD_POINT']);
  });

  it('a move with two points is SGF_BAD_POINT', () => {
    expect(codes('(;SZ[5];B[aa][bb])')).toEqual(['SGF_BAD_POINT']);
  });

  it('nodes without a move (comments) are skipped', () => {
    expect(problem('(;SZ[5];C[think];B[aa];C[ok]W[bb])').line).toEqual([
      { color: 'B', at: 'a5' },
      { color: 'W', at: 'b4' },
    ]);
  });
});

describe('convertSgf: variations (AC 17)', () => {
  it('a variation after the second move is SGF_NESTED_VARIATION at that node', () => {
    const text = '(;SZ[5];B[aa];W[bb]\n(;B[cc])\n(;B[dd]))';
    expect(errors(text)).toEqual([
      expect.objectContaining({ code: 'SGF_NESTED_VARIATION', line: 3, col: 2 }),
    ]);
  });

  it('a variation inside a wrong branch is SGF_NESTED_VARIATION', () => {
    expect(codes('(;SZ[5](;B[aa])(;B[bb](;W[cc])(;W[dd])))')).toEqual(['SGF_NESTED_VARIATION']);
  });

  it('two branches with the same first move is SGF_DUPLICATE_BRANCH', () => {
    expect(errors('(;SZ[5](;B[aa])(;B[bb])(;B[aa];W[cc]))')).toEqual([
      expect.objectContaining({ code: 'SGF_DUPLICATE_BRANCH', line: 1, col: 25 }),
    ]);
  });

  it('several wrong branches keep their order', () => {
    const p = problem('(;SZ[5](;B[aa])(;B[bb];W[cc])(;B[dd]))');
    expect(p.wrong.map((w) => w.line.map((m) => m.at))).toEqual([['b4', 'c3'], ['d2']]);
  });

  it('the branch point may be a node without a move', () => {
    const p = problem('(;SZ[5]AB[cc];C[Black to play](;B[aa])(;B[bb]))');
    expect(p.line).toEqual([{ color: 'B', at: 'a5' }]);
    expect(p.wrong).toEqual([{ line: [{ color: 'B', at: 'b4' }] }]);
  });
});

describe('convertSgf: other properties (AC 18)', () => {
  it('TR warns, GN is silent, both convert, and C never appears', () => {
    const result = convert('(;GM[1]FF[4]GN[x]SZ[5]C[note]TR[bb](;B[cd]C[good])(;B[ae]))');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'SGF_UNSUPPORTED_PROPERTY', line: 1, col: 30 }),
    ]);
    expect(result.warnings[0].message).toContain('TR');
    expect(JSON.stringify(result.problem)).not.toMatch(/note|good/);
  });

  it.each([
    ['FF[3]'],
    ['CA[UTF-8]'],
    ['AP[Sabaki:0.52]'],
    ['KM[7.5]'],
    ['RU[Chinese]'],
    ['PB[me]'],
  ])('%s is metadata and ignored silently', (meta) => {
    const result = convert(`(;SZ[5]${meta};B[aa])`);
    expect(result.ok && result.warnings).toEqual([]);
  });

  it('the file name is copied into every issue', () => {
    const parsed = parseSgf('(;SZ[19];B[aa])');
    if (!parsed.ok) throw new Error('parse');
    const result = convertSgf(parsed.tree, { file: 'u10/e1.sgf' });
    expect(!result.ok && result.errors[0].file).toBe('u10/e1.sgf');
  });

  it('reports several independent errors at once', () => {
    expect(codes('(;SZ[5]AB[zz];B[aa];B[bb])')).toEqual(['SGF_BAD_POINT', 'SGF_NOT_ALTERNATING']);
  });
});
