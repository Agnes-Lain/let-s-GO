import {
  groupAt,
  isAtari,
  liberties,
  parseBoard,
  parseVertex,
  toVertex,
  type BoardSize,
  type Point,
} from './index';

/** Writes points as vertices so expectations read like Go diagrams. */
function names(points: Point[] | null | undefined, size: BoardSize = 5): string[] | null {
  return points ? points.map((p) => toVertex(p, size)) : null;
}

function boardWithBlackAt(vertex: string) {
  const { board } = parseBoard(
    ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .'].join('\n'),
  );
  const { x, y } = parseVertex(vertex, 5);
  const cells = [...board.cells];
  cells[y * 5 + x] = 'B';
  return { ...board, cells };
}

const AC8 = parseBoard(`
  5 . . . . .
  4 . . . . .
  3 . . X O .
  2 . X X . .
  1 . . . . .
    a b c d e
`).board;

const AC9 = parseBoard(`
  5 . . . . .
  4 . . . . .
  3 . . X . .
  2 . X . . .
  1 . . . . .
    a b c d e
`).board;

const AC4 = parseBoard(`
  5 . . . . .
  4 . . . . .
  3 . O X O .
  2 . . O . .
  1 . . . . .
    a b c d e
`).board;

describe('groups and liberties', () => {
  it('AC 7: a single stone in the center has 4 liberties', () => {
    expect(names(liberties(boardWithBlackAt('c3'), 'c3'))).toEqual(['b3', 'c2', 'c4', 'd3']);
  });

  it('AC 7: a single stone on the edge has 3 liberties', () => {
    expect(names(liberties(boardWithBlackAt('c1'), 'c1'))).toEqual(['b1', 'c2', 'd1']);
  });

  it('AC 7: a single stone in the corner has 2 liberties', () => {
    expect(names(liberties(boardWithBlackAt('a1'), 'a1'))).toEqual(['a2', 'b1']);
  });

  it('AC 8: a connected group shares its liberties, each counted once', () => {
    const group = groupAt(AC8, 'c3');
    expect(group?.color).toBe('B');
    expect(names(group?.stones)).toEqual(['b2', 'c2', 'c3']);
    expect(names(group?.liberties)).toEqual(['a2', 'b1', 'b3', 'c1', 'c4', 'd2']);
    expect(group?.liberties).toHaveLength(6);
  });

  it('AC 8: the same group is found from any of its stones', () => {
    expect(groupAt(AC8, 'b2')).toEqual(groupAt(AC8, 'c3'));
    expect(groupAt(AC8, { x: 2, y: 1 })).toEqual(groupAt(AC8, 'c3'));
  });

  it('AC 8: the white stone next to the group has its own liberties', () => {
    expect(names(liberties(AC8, 'd3'))).toEqual(['d2', 'd4', 'e3']);
    expect(groupAt(AC8, 'd3')?.color).toBe('W');
  });

  it('AC 9: diagonal stones are two separate groups, lists sorted by column then row', () => {
    const b2 = groupAt(AC9, 'b2');
    expect(names(b2?.stones)).toEqual(['b2']);
    expect(names(b2?.liberties)).toEqual(['a2', 'b1', 'b3', 'c2']);
    const c3 = groupAt(AC9, 'c3');
    expect(names(c3?.stones)).toEqual(['c3']);
    expect(names(c3?.liberties)).toEqual(['b3', 'c2', 'c4', 'd3']);
  });

  it('AC 9: a large group lists its stones sorted by column, then row', () => {
    const { board } = parseBoard(`
      . . . . .
      . X X X .
      . X . X .
      . X X X .
      . . . . .
    `);
    expect(names(groupAt(board, 'd4')?.stones)).toEqual([
      'b2',
      'b3',
      'b4',
      'c2',
      'c4',
      'd2',
      'd3',
      'd4',
    ]);
  });

  it('AC 10: an empty point has no group, no liberties and is not in atari', () => {
    expect(groupAt(AC8, 'a1')).toBeNull();
    expect(liberties(AC8, 'a1')).toBeNull();
    expect(isAtari(AC8, 'a1')).toBe(false);
  });

  it('AC 10: on AC 4 board, c3 is in atari and c2 is not', () => {
    expect(isAtari(AC4, 'c3')).toBe(true);
    expect(isAtari(AC4, 'c2')).toBe(false);
    expect(names(liberties(AC4, 'c3'))).toEqual(['c4']);
  });

  it('AC 10: queries do not modify the board', () => {
    const before = JSON.parse(JSON.stringify(AC8));
    groupAt(AC8, 'c3');
    liberties(AC8, 'd3');
    isAtari(AC8, 'b2');
    expect(AC8).toEqual(before);
  });

  it('queries reject points that are not on the board', () => {
    expect(() => groupAt(AC8, 'f1')).toThrow(expect.objectContaining({ code: 'invalid-vertex' }));
    expect(() => liberties(AC8, { x: -1, y: 0 })).toThrow(
      expect.objectContaining({ code: 'invalid-vertex' }),
    );
    expect(() => isAtari(AC8, { x: 0, y: 5 })).toThrow(
      expect.objectContaining({ code: 'invalid-vertex' }),
    );
  });
});
