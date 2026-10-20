// SGF point values (spec M5-sgf-import §4). SGF `xy`: two letters a.. from the TOP-LEFT corner.
// Engine vertex: column letter from the left (no 'i'), row number from the BOTTOM.

/** Same letters as the engine (src/engine/coordinates.ts); repeated so src/sgf has no runtime deps. */
const COLUMN_LETTERS = 'abcdefghjklmnopqrst';
const SGF_LETTERS = 'abcdefghijklmnopqrs';

/** 'cd' -> {x: 2, y: 3} (SGF axes, from the top-left), or null when off a `size` board. */
function sgfXY(xy: string, size: number): { x: number; y: number } | null {
  if (xy.length !== 2) return null;
  const x = SGF_LETTERS.indexOf(xy[0]);
  const y = SGF_LETTERS.indexOf(xy[1]);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}

/** 'cd' on 5×5 -> 'c2'. Null for anything that is not a point on the board (passes included). */
export function sgfPoint(xy: string, size: number): string | null {
  const p = sgfXY(xy, size);
  return p ? `${COLUMN_LETTERS[p.x]}${size - p.y}` : null;
}

/**
 * Expands one point-list value: a single point ('cd') or a compressed rectangle ('aa:cc', from
 * the top-left to the bottom-right corner). Returns SGF points, or null when the value is not
 * valid on a `size` board.
 */
export function sgfPoints(value: string, size: number): string[] | null {
  const parts = value.split(':');
  if (parts.length === 1) return sgfXY(value, size) ? [value] : null;
  if (parts.length !== 2) return null;
  const from = sgfXY(parts[0], size);
  const to = sgfXY(parts[1], size);
  if (!from || !to || to.x < from.x || to.y < from.y) return null;
  const out: string[] = [];
  for (let x = from.x; x <= to.x; x++) {
    for (let y = from.y; y <= to.y; y++) out.push(SGF_LETTERS[x] + SGF_LETTERS[y]);
  }
  return out;
}
