import type { Board, BoardSize, Color, Point } from './types';

export function emptyBoard(size: BoardSize): Board {
  return { size, cells: Array<Color | null>(size * size).fill(null) };
}

export function indexOf(point: Point, size: BoardSize): number {
  return point.y * size + point.x;
}

export function pointOf(index: number, size: BoardSize): Point {
  return { x: index % size, y: Math.floor(index / size) };
}

/** The stone on a point that is on the board, or null when the point is empty. */
export function stoneAt(board: Board, point: Point): Color | null {
  return board.cells[indexOf(point, board.size)];
}

/** Returns a new board with `color` (or nothing) on each point. The input is not changed. */
export function withStones(board: Board, points: readonly Point[], color: Color | null): Board {
  const cells = [...board.cells];
  for (const point of points) cells[indexOf(point, board.size)] = color;
  return { size: board.size, cells };
}

/** Orthogonal neighbours on the board (2 in a corner, 3 on an edge, 4 in the center). */
export function neighbors(point: Point, size: BoardSize): Point[] {
  const { x, y } = point;
  const candidates = [
    { x: x - 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
    { x: x + 1, y },
  ];
  return candidates.filter((p) => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size);
}
