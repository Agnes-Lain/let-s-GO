// Eyes (眼 yǎn) for the 9×9 bots (spec docs/specs/M6-bot-levels.md §6): a bot never fills its own
// single-point eye. Pure: reads the board, changes nothing.
import type { Board, Color, Point } from '@/engine';

/**
 * A single-point eye of `color` (眼 yǎn): the point is empty, every orthogonal neighbour is a
 * `color` stone, and enough diagonals are `color` stones (an off-board diagonal counts as own):
 * at least 3 of 4 in the centre, all 4 on the edge or in the corner. Fewer means a false eye
 * (假眼 jiǎyǎn) that the opponent can break, so it may be filled.
 */
export function isOwnEye(board: Board, p: Point, color: Color): boolean {
  const { size, cells } = board;
  const at = (x: number, y: number) => cells[y * size + x];
  if (at(p.x, p.y) !== null) return false;
  const orthogonal = [
    [p.x - 1, p.y],
    [p.x + 1, p.y],
    [p.x, p.y - 1],
    [p.x, p.y + 1],
  ];
  for (const [x, y] of orthogonal) {
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    if (at(x, y) !== color) return false;
  }
  let own = 0;
  let offBoard = 0;
  for (const [dx, dy] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (x < 0 || y < 0 || x >= size || y >= size) {
      own++;
      offBoard++;
    } else if (at(x, y) === color) {
      own++;
    }
  }
  return offBoard > 0 ? own === 4 : own >= 3;
}
