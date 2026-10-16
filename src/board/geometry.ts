// Pure board geometry: pixel <-> point maths, labels, star points. No React / RN imports.
import { parseVertex, toVertex } from '@/engine';
import type { BoardSize, Color, Point, Vertex } from '@/engine';

export interface BoardGeometry {
  size: BoardSize;
  width: number;
  cell: number;
  /** px from the board edge to the first line (same on all four sides). */
  origin: number;
  stoneRadius: number;
  starRadius: number;
  lastMoveRadius: number;
  labelFontSize: number;
}

const COLUMNS = 'ABCDEFGHJKLMNOPQRST';

const STAR_VERTICES: Record<BoardSize, Vertex[]> = {
  5: ['c3'],
  7: ['d4'],
  9: ['c3', 'c7', 'e5', 'g3', 'g7'],
  13: ['d4', 'd10', 'g7', 'k4', 'k10'],
  19: ['d4', 'd10', 'd16', 'k4', 'k10', 'k16', 'q4', 'q10', 'q16'],
};

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export function columnLabels(size: BoardSize): string[] {
  return COLUMNS.slice(0, size).split('');
}

/** Top to bottom: ['9', ..., '1']. */
export function rowLabels(size: BoardSize): string[] {
  return Array.from({ length: size }, (_, i) => String(size - i));
}

export function starPoints(size: BoardSize): Vertex[] {
  return [...STAR_VERTICES[size]];
}

export function boardGeometry(
  size: BoardSize,
  width: number,
  showCoordinates: boolean,
): BoardGeometry {
  const margin = !showCoordinates ? 0.6 : size >= 13 ? 1.2 : 1.0;
  const cell = width / (size - 1 + 2 * margin);
  return {
    size,
    width,
    cell,
    origin: margin * cell,
    stoneRadius: 0.47 * cell,
    starRadius: clamp(2.5, 0.09 * cell, 4),
    lastMoveRadius: clamp(3, 0.16 * cell, 6),
    labelFontSize: clamp(10, 0.36 * cell, 13),
  };
}

/** Nearest intersection to a pixel location, or null when more than half a cell off the grid. */
export function pointFromLocation(g: BoardGeometry, x: number, y: number): Point | null {
  const col = Math.round((x - g.origin) / g.cell);
  const row = Math.round((y - g.origin) / g.cell);
  if (col < 0 || row < 0 || col >= g.size || row >= g.size) return null;
  return { x: col + 0, y: g.size - 1 - row };
}

export function pointToLocation(g: BoardGeometry, p: Point): { x: number; y: number } {
  return { x: g.origin + p.x * g.cell, y: g.origin + (g.size - 1 - p.y) * g.cell };
}

export function vertexLabel(p: Point, size: BoardSize): string {
  return toVertex(p, size).toUpperCase();
}

/** Row-major cells (index y*size+x) from vertex lists. Throws EngineError('invalid-vertex'). */
export function stonesFromSetup(
  size: BoardSize,
  setup: { B?: Vertex[]; W?: Vertex[] },
): (Color | null)[] {
  const cells: (Color | null)[] = Array.from({ length: size * size }, () => null);
  for (const color of ['B', 'W'] as const) {
    for (const vertex of setup[color] ?? []) {
      const p = parseVertex(vertex, size);
      cells[p.y * size + p.x] = color;
    }
  }
  return cells;
}
