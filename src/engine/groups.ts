import { indexOf, neighbors, pointOf, stoneAt } from './board';
import { comparePoints, toPoint } from './coordinates';
import type { Board, Group, Point, Vertex } from './types';

/** The group (chain of connected same-colored stones) on a point, or null on an empty point. */
export function groupAt(board: Board, at: Point | Vertex): Group | null {
  const start = toPoint(at, board.size);
  const color = stoneAt(board, start);
  if (color === null) return null;

  const stoneIndexes = new Set<number>([indexOf(start, board.size)]);
  const libertyIndexes = new Set<number>();
  const toVisit: Point[] = [start];

  while (toVisit.length > 0) {
    const stone = toVisit.pop() as Point;
    for (const neighbor of neighbors(stone, board.size)) {
      const index = indexOf(neighbor, board.size);
      const neighborColor = stoneAt(board, neighbor);
      if (neighborColor === null) {
        libertyIndexes.add(index);
      } else if (neighborColor === color && !stoneIndexes.has(index)) {
        stoneIndexes.add(index);
        toVisit.push(neighbor);
      }
    }
  }

  return {
    color,
    stones: sortedPoints(stoneIndexes, board),
    liberties: sortedPoints(libertyIndexes, board),
  };
}

/** The liberties (气 qì) of the group on a point, or null on an empty point. */
export function liberties(board: Board, at: Point | Vertex): Point[] | null {
  return groupAt(board, at)?.liberties ?? null;
}

/** True when the group on a point has exactly one liberty (叫吃 jiàochī). False on an empty point. */
export function isAtari(board: Board, at: Point | Vertex): boolean {
  return groupAt(board, at)?.liberties.length === 1;
}

function sortedPoints(indexes: Set<number>, board: Board): Point[] {
  return [...indexes].map((index) => pointOf(index, board.size)).sort(comparePoints);
}
