import { createGame, defaultKomi, EngineError, type BoardSize } from './index';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EngineError ? error.code : 'not-an-engine-error';
  }
  return undefined;
}

describe('createGame', () => {
  it.each([5, 7, 9, 13, 19])('AC 1: creates an empty %ix%i game, black to play', (size) => {
    const state = createGame(size);
    expect(state.board.size).toBe(size);
    expect(state.board.cells).toHaveLength(size * size);
    expect(state.board.cells.every((cell) => cell === null)).toBe(true);
    expect(state.toPlay).toBe('B');
    expect(state.consecutivePasses).toBe(0);
    expect(state.isOver).toBe(false);
    expect(state.captures).toEqual({ B: 0, W: 0 });
    expect(state.koPoint).toBeNull();
    expect(state.moves).toEqual([]);
  });

  it.each([0, 4, 6, 8, 21, 9.5, -9, NaN, Infinity])('AC 1: size %p throws invalid-size', (size) => {
    expect(errorCode(() => createGame(size))).toBe('invalid-size');
  });

  it('AC 1 / AC 27: uses the default komi for the board size', () => {
    expect(createGame(5).komi).toBe(0.5);
    expect(createGame(7).komi).toBe(0.5);
    expect(createGame(9).komi).toBe(7.5);
    expect(createGame(13).komi).toBe(7.5);
    expect(createGame(19).komi).toBe(7.5);
    expect(createGame(9, { komi: 5.5 }).komi).toBe(5.5);
  });

  it('AC 27: defaultKomi per size', () => {
    const expected: [BoardSize, number][] = [
      [5, 0.5],
      [7, 0.5],
      [9, 7.5],
      [13, 7.5],
      [19, 7.5],
    ];
    for (const [size, komi] of expected) {
      expect(defaultKomi(size)).toBe(komi);
    }
  });

  it('AC 4: places setup stones and sets the player to move', () => {
    const state = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' });
    expect(state.toPlay).toBe('W');
    expect(state.board.cells[2 * 5 + 2]).toBe('B'); // c3
    expect(state.board.cells[1 * 5 + 2]).toBe('W'); // c2
    expect(state.board.cells[2 * 5 + 1]).toBe('W'); // b3
    expect(state.board.cells[2 * 5 + 3]).toBe('W'); // d3
    expect(state.board.cells.filter((cell) => cell !== null)).toHaveLength(4);
    expect(state.moves).toEqual([]);
  });

  it('AC 6: setup accepts uppercase vertices and empty lists', () => {
    const state = createGame(5, { setup: { B: ['C3'], W: [] } });
    expect(state.board.cells[2 * 5 + 2]).toBe('B');
  });

  it('AC 6: a point listed twice throws invalid-setup', () => {
    expect(errorCode(() => createGame(5, { setup: { B: ['c3', 'c3'] } }))).toBe('invalid-setup');
    expect(errorCode(() => createGame(5, { setup: { B: ['c3', 'C3'] } }))).toBe('invalid-setup');
  });

  it('AC 6: a point in both B and W throws invalid-setup', () => {
    expect(errorCode(() => createGame(5, { setup: { B: ['c3'], W: ['c3'] } }))).toBe(
      'invalid-setup',
    );
  });

  it('AC 6: a group with 0 liberties throws invalid-setup', () => {
    // 2 O . . . .
    // 1 X O . . .
    expect(errorCode(() => createGame(5, { setup: { B: ['a1'], W: ['a2', 'b1'] } }))).toBe(
      'invalid-setup',
    );
    // A whole group without liberties:
    // 2 O O O . .
    // 1 X X O . .
    expect(
      errorCode(() => createGame(5, { setup: { B: ['a1', 'b1'], W: ['a2', 'b2', 'c2', 'c1'] } })),
    ).toBe('invalid-setup');
  });

  it('AC 6: a vertex that is not on the board throws invalid-setup', () => {
    expect(errorCode(() => createGame(5, { setup: { W: ['f1'] } }))).toBe('invalid-setup');
  });

  it('AC 6: an unknown toPlay throws invalid-setup', () => {
    expect(errorCode(() => createGame(5, { toPlay: 'X' as never }))).toBe('invalid-setup');
  });

  it.each([5.25, 7.4, NaN, Infinity, -Infinity])('AC 6: komi %p throws invalid-komi', (komi) => {
    expect(errorCode(() => createGame(9, { komi }))).toBe('invalid-komi');
  });

  it.each([0, 0.5, 6, 7.5, -3.5])('AC 6: komi %p is accepted', (komi) => {
    expect(createGame(9, { komi }).komi).toBe(komi);
  });

  it('EngineError carries its code and is an Error', () => {
    try {
      createGame(4);
      throw new Error('expected createGame(4) to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe('invalid-size');
      expect((error as EngineError).name).toBe('EngineError');
    }
  });
});
