import { createGame, EngineError, parseBoard, parseVertex, printBoard, type Board } from './index';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EngineError ? error.code : 'not-an-engine-error';
  }
  return undefined;
}

const AC4_WITH_COORDS = [
  '5 . . . . .',
  '4 . . . . .',
  '3 . O X O .',
  '2 . . O . .',
  '1 . . . . .',
  '  a b c d e',
].join('\n');

const AC4_PLAIN = ['. . . . .', '. . . . .', '. O X O .', '. . O . .', '. . . . .'].join('\n');

/** A deterministic mixed board (not necessarily a legal Go position). */
function patternBoard(size: Board['size']): Board {
  const cells = Array.from({ length: size * size }, (_, i) => {
    const r = (i * 7 + Math.floor(i / 3)) % 3;
    return r === 0 ? null : r === 1 ? 'B' : 'W';
  });
  return { size, cells } as Board;
}

describe('printBoard / parseBoard', () => {
  it('AC 4: prints the setup position with coordinates', () => {
    const state = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' });
    expect(printBoard(state.board, { coords: true })).toBe(AC4_WITH_COORDS);
  });

  it('AC 4: prints without coordinates by default', () => {
    const state = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] } });
    expect(printBoard(state.board)).toBe(AC4_PLAIN);
  });

  it('AC 5: parseBoard(printBoard(B)).board deep-equals B for every size, with and without coords', () => {
    for (const size of [5, 7, 9, 13, 19] as const) {
      for (const board of [createGame(size).board, patternBoard(size)]) {
        expect(parseBoard(printBoard(board)).board).toEqual(board);
        expect(parseBoard(printBoard(board, { coords: true })).board).toEqual(board);
      }
    }
  });

  it('AC 5: a canonical string round-trips, with and without coords', () => {
    expect(printBoard(parseBoard(AC4_WITH_COORDS).board, { coords: true })).toBe(AC4_WITH_COORDS);
    expect(printBoard(parseBoard(AC4_PLAIN).board)).toBe(AC4_PLAIN);
  });

  it('AC 5: 19x19 coordinates are right-aligned and end at column t', () => {
    const text = printBoard(createGame(19).board, { coords: true });
    const lines = text.split('\n');
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('19' + ' .'.repeat(19));
    expect(lines[10]).toBe(' 9' + ' .'.repeat(19));
    expect(lines[19]).toBe('   a b c d e f g h j k l m n o p q r s t');
    expect(printBoard(parseBoard(text).board, { coords: true })).toBe(text);
  });

  it('AC 5: markers *, x and o round-trip via points and marked', () => {
    const text = [
      '5 . . . . .',
      '4 . . X . .',
      '3 . X O * .',
      '2 . x . . .',
      '1 o . . . *',
      '  a b c d e',
    ].join('\n');
    const { board, marked, points } = parseBoard(text);
    expect(board.cells[parseIndex('b2')]).toBe('B');
    expect(board.cells[parseIndex('a1')]).toBe('W');
    expect(board.cells[parseIndex('d3')]).toBeNull();
    // sorted by column, then row
    expect(marked).toEqual([parseVertex('a1', 5), parseVertex('b2', 5)]);
    expect(points).toEqual([parseVertex('d3', 5), parseVertex('e1', 5)]);
    expect(printBoard(board, { coords: true, marked, points })).toBe(text);
  });

  it('AC 5: returns empty marker lists when there are none', () => {
    const { marked, points } = parseBoard(AC4_PLAIN);
    expect(marked).toEqual([]);
    expect(points).toEqual([]);
  });

  it('AC 5: accepts cells without spaces, indentation and blank lines', () => {
    const text = `

      .....
      .....
      .OXO.

      ..O..
      .....
    `;
    expect(printBoard(parseBoard(text).board)).toBe(AC4_PLAIN);
  });

  it('AC 6: a non-square grid throws invalid-ascii', () => {
    expect(errorCode(() => parseBoard('. . . . .\n. . . . .\n. . . . .\n. . . . .'))).toBe(
      'invalid-ascii',
    );
    expect(errorCode(() => parseBoard('. . . . .\n. . . .\n. . . . .\n. . . . .\n. . . . .'))).toBe(
      'invalid-ascii',
    );
  });

  it('AC 6: a 6x6 grid throws invalid-ascii', () => {
    const sixBySix = Array.from({ length: 6 }, () => '. . . . . .').join('\n');
    expect(errorCode(() => parseBoard(sixBySix))).toBe('invalid-ascii');
  });

  it('AC 6: an unknown character throws invalid-ascii', () => {
    expect(errorCode(() => parseBoard(AC4_PLAIN.replace('O', '#')))).toBe('invalid-ascii');
  });

  it('AC 6: an empty string throws invalid-ascii', () => {
    expect(errorCode(() => parseBoard(''))).toBe('invalid-ascii');
  });

  it('AC 6: wrong row numbers or a wrong letter line throw invalid-ascii', () => {
    expect(errorCode(() => parseBoard(AC4_WITH_COORDS.replace('4 .', '7 .')))).toBe(
      'invalid-ascii',
    );
    expect(errorCode(() => parseBoard(AC4_WITH_COORDS.replace('a b c d e', 'a b c d f')))).toBe(
      'invalid-ascii',
    );
    // row numbers on some lines only
    expect(errorCode(() => parseBoard(AC4_WITH_COORDS.replace('4 .', '.')))).toBe('invalid-ascii');
  });

  it('printBoard rejects markers that do not fit the board', () => {
    const { board } = parseBoard(AC4_PLAIN);
    // marked must be a stone, points must be empty
    expect(errorCode(() => printBoard(board, { marked: [parseVertex('a1', 5)] }))).toBe(
      'invalid-ascii',
    );
    expect(errorCode(() => printBoard(board, { points: [parseVertex('c3', 5)] }))).toBe(
      'invalid-ascii',
    );
    expect(errorCode(() => printBoard(board, { points: [{ x: 5, y: 0 }] }))).toBe('invalid-vertex');
  });
});

function parseIndex(vertex: string): number {
  const { x, y } = parseVertex(vertex, 5);
  return y * 5 + x;
}
