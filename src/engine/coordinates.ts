import { EngineError, type BoardSize, type Point, type Vertex } from './types';

export const BOARD_SIZES: readonly BoardSize[] = [5, 7, 9, 13, 19];

/** Column letters a–t, skipping 'i' (it looks like 'j' and '1'). */
const COLUMN_LETTERS = 'abcdefghjklmnopqrst';

const VERTEX_PATTERN = /^([a-z])([1-9][0-9]?)$/;

export function isBoardSize(size: unknown): size is BoardSize {
  return BOARD_SIZES.includes(size as BoardSize);
}

export function isOnBoard(point: Point, size: BoardSize): boolean {
  const { x, y } = point;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
}

/** 'c3' -> {x: 2, y: 2}. Case-insensitive. Throws EngineError('invalid-vertex'). */
export function parseVertex(vertex: Vertex, size: BoardSize): Point {
  const match = typeof vertex === 'string' ? VERTEX_PATTERN.exec(vertex.toLowerCase()) : null;
  const x = match ? COLUMN_LETTERS.indexOf(match[1]) : -1;
  const y = match ? Number(match[2]) - 1 : -1;
  if (!match || x < 0 || !isOnBoard({ x, y }, size)) {
    throw new EngineError(
      'invalid-vertex',
      `"${vertex}" is not a point on a ${size}×${size} board`,
    );
  }
  return { x, y };
}

/** {x: 2, y: 2} -> 'c3'. Throws EngineError('invalid-vertex') for a point off the board. */
export function toVertex(point: Point, size: BoardSize): Vertex {
  assertOnBoard(point, size);
  return `${COLUMN_LETTERS[point.x]}${point.y + 1}`;
}

/** Accepts either notation and returns a point on the board, or throws invalid-vertex. */
export function toPoint(at: Point | Vertex, size: BoardSize): Point {
  if (typeof at === 'string') return parseVertex(at, size);
  assertOnBoard(at, size);
  return { x: at.x, y: at.y };
}

export function columnLetter(x: number): string {
  return COLUMN_LETTERS[x];
}

/** Sort order for every point list the engine returns: by column (x), then row (y). */
export function comparePoints(a: Point, b: Point): number {
  return a.x - b.x || a.y - b.y;
}

function assertOnBoard(point: Point, size: BoardSize): void {
  if (!point || !isOnBoard(point, size)) {
    throw new EngineError(
      'invalid-vertex',
      `${JSON.stringify(point)} is not a point on a ${size}×${size} board`,
    );
  }
}
