// Fast playout board for the 9×9 bots (spec docs/specs/M6-bot-levels.md §6.3, §13 risk 1). The
// engine is immutable and copies arrays on every move: 1 200 random games with it took ~8.6 s per
// bot move on desktop Node (§12b), so the Monte-Carlo playouts run on this small MUTABLE board
// instead. It is private to src/bot, still pure (no I/O, clock or global randomness: the Rng is
// injected), and playout.test.ts checks every rule against the engine on thousands of positions.
import type { Color, GameState } from '@/engine';

/** Cells hold 0 = empty, 1 = black, 2 = white. */
type Stone = 1 | 2;

const EMPTY = 0;

export function stoneOf(color: Color): Stone {
  return color === 'B' ? 1 : 2;
}

export function colorOf(stone: Stone): Color {
  return stone === 1 ? 'B' : 'W';
}

function other(stone: Stone): Stone {
  return stone === 1 ? 2 : 1;
}

/** Neighbour and diagonal tables per board size (4 entries per cell, -1 = off the board). */
interface Tables {
  adj: Int16Array;
  diag: Int16Array;
}

const tableCache = new Map<number, Tables>();

function tablesFor(size: number): Tables {
  const cached = tableCache.get(size);
  if (cached) return cached;
  const count = size * size;
  const adj = new Int16Array(count * 4).fill(-1);
  const diag = new Int16Array(count * 4).fill(-1);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;
  for (let cell = 0; cell < count; cell++) {
    const x = cell % size;
    const y = Math.floor(cell / size);
    const around = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    const corners = [
      [x - 1, y - 1],
      [x - 1, y + 1],
      [x + 1, y - 1],
      [x + 1, y + 1],
    ];
    around.forEach(([nx, ny], k) => {
      if (on(nx, ny)) adj[cell * 4 + k] = ny * size + nx;
    });
    corners.forEach(([nx, ny], k) => {
      if (on(nx, ny)) diag[cell * 4 + k] = ny * size + nx;
    });
  }
  const tables = { adj, diag };
  tableCache.set(size, tables);
  return tables;
}

/**
 * A mutable Go board with the engine's rules (captures, suicide forbidden, simple ko). Cells are
 * indexed like the engine (`y * size + x`). Only for playouts: `play` assumes a legal move.
 */
export class PlayoutBoard {
  readonly size: number;
  readonly count: number;
  readonly cells: Uint8Array;
  toPlay: Stone;
  /** Cell forbidden for `toPlay` by simple ko, -1 when none. */
  ko = -1;
  passes = 0;
  /** Moves and passes played on this board. */
  plies = 0;

  private readonly adj: Int16Array;
  private readonly diag: Int16Array;
  private readonly stamp: Int32Array;
  private readonly seen: Int32Array;
  private mark = 0;
  private seenMark = 0;
  private readonly stack: Int16Array;
  private readonly buffer: Int16Array;

  constructor(size: number) {
    this.size = size;
    this.count = size * size;
    this.cells = new Uint8Array(this.count);
    this.toPlay = 1;
    const { adj, diag } = tablesFor(size);
    this.adj = adj;
    this.diag = diag;
    this.stamp = new Int32Array(this.count);
    this.seen = new Int32Array(this.count);
    this.stack = new Int16Array(this.count);
    this.buffer = new Int16Array(this.count);
  }

  static fromState(state: GameState): PlayoutBoard {
    const board = new PlayoutBoard(state.board.size);
    state.board.cells.forEach((stone, i) => {
      board.cells[i] = stone === null ? EMPTY : stoneOf(stone);
    });
    board.toPlay = stoneOf(state.toPlay);
    board.ko = state.koPoint ? state.koPoint.y * state.board.size + state.koPoint.x : -1;
    board.passes = state.consecutivePasses;
    return board;
  }

  /** Makes this board a copy of `source` (same size), without allocating. */
  copyFrom(source: PlayoutBoard): void {
    this.cells.set(source.cells);
    this.toPlay = source.toPlay;
    this.ko = source.ko;
    this.passes = source.passes;
    this.plies = source.plies;
  }

  /** Liberties of the group on `cell`, counted up to `limit` (then it stops early). */
  liberties(cell: number, limit = this.count): number {
    const color = this.cells[cell];
    const m = ++this.mark;
    const { cells, adj, stamp, stack } = this;
    let sp = 0;
    stack[sp++] = cell;
    stamp[cell] = m;
    let libs = 0;
    while (sp > 0) {
      const c = stack[--sp];
      for (let k = c * 4, end = k + 4; k < end; k++) {
        const n = adj[k];
        if (n < 0 || stamp[n] === m) continue;
        const v = cells[n];
        if (v === EMPTY) {
          stamp[n] = m;
          if (++libs >= limit) return libs;
        } else if (v === color) {
          stamp[n] = m;
          stack[sp++] = n;
        }
      }
    }
    return libs;
  }

  /** Whether `toPlay` may play on `cell` (empty, not the ko point, not suicide). */
  isLegal(cell: number): boolean {
    if (this.cells[cell] !== EMPTY || cell === this.ko) return false;
    const color = this.toPlay;
    const { adj, cells } = this;
    for (let k = cell * 4, end = k + 4; k < end; k++) {
      const n = adj[k];
      if (n < 0) continue;
      const v = cells[n];
      if (v === EMPTY) return true;
      const libs = this.liberties(n, 2);
      if (v === color ? libs >= 2 : libs === 1) return true;
    }
    return false;
  }

  /** The engine's single-point eye rule (eyes.ts `isOwnEye`) on this board. */
  isOwnEye(cell: number, color: Stone): boolean {
    const { adj, diag, cells } = this;
    if (cells[cell] !== EMPTY) return false;
    for (let k = cell * 4, end = k + 4; k < end; k++) {
      const n = adj[k];
      if (n >= 0 && cells[n] !== color) return false;
    }
    let own = 0;
    let offBoard = 0;
    for (let k = cell * 4, end = k + 4; k < end; k++) {
      const n = diag[k];
      if (n < 0) {
        own++;
        offBoard++;
      } else if (cells[n] === color) {
        own++;
      }
    }
    return offBoard > 0 ? own === 4 : own >= 3;
  }

  /** Plays a legal move for `toPlay`; returns the number of captured stones. */
  play(cell: number): number {
    const color = this.toPlay;
    const enemy = other(color);
    const { adj, cells } = this;
    cells[cell] = color;
    let captured = 0;
    let lastCaptured = -1;
    let friends = false;
    for (let k = cell * 4, end = k + 4; k < end; k++) {
      const n = adj[k];
      if (n < 0) continue;
      if (cells[n] === color) friends = true;
      else if (cells[n] === enemy && this.liberties(n, 1) === 0) {
        captured += this.remove(n);
        lastCaptured = n;
      }
    }
    this.ko = captured === 1 && !friends && this.liberties(cell, 2) === 1 ? lastCaptured : -1;
    this.toPlay = enemy;
    this.passes = 0;
    this.plies++;
    return captured;
  }

  pass(): void {
    this.toPlay = other(this.toPlay);
    this.ko = -1;
    this.passes++;
    this.plies++;
  }

  private remove(cell: number): number {
    const color = this.cells[cell];
    const { cells, adj, stack } = this;
    let sp = 0;
    stack[sp++] = cell;
    cells[cell] = EMPTY;
    let removed = 0;
    while (sp > 0) {
      const c = stack[--sp];
      removed++;
      for (let k = c * 4, end = k + 4; k < end; k++) {
        const n = adj[k];
        if (n >= 0 && cells[n] === color) {
          cells[n] = EMPTY;
          stack[sp++] = n;
        }
      }
    }
    return removed;
  }

  /**
   * Cells where `toPlay` captures at least one stone (the last liberty of an opponent group in
   * atari, unless it is the ko point). Written into `out`; returns how many.
   */
  captureMoves(out: Int16Array): number {
    const enemy = other(this.toPlay);
    const { cells, adj, seen, stamp, stack } = this;
    const scan = ++this.seenMark;
    let found = 0;
    for (let start = 0; start < this.count; start++) {
      if (cells[start] !== enemy || seen[start] === scan) continue;
      const m = ++this.mark;
      let sp = 0;
      stack[sp++] = start;
      seen[start] = scan;
      let libs = 0;
      let lastLib = -1;
      while (sp > 0) {
        const c = stack[--sp];
        for (let k = c * 4, end = k + 4; k < end; k++) {
          const n = adj[k];
          if (n < 0) continue;
          const v = cells[n];
          if (v === EMPTY) {
            if (stamp[n] !== m) {
              stamp[n] = m;
              libs++;
              lastLib = n;
            }
          } else if (v === enemy && seen[n] !== scan) {
            seen[n] = scan;
            stack[sp++] = n;
          }
        }
      }
      if (libs === 1 && lastLib !== this.ko && !contains(out, found, lastLib)) {
        out[found++] = lastLib;
      }
    }
    return found;
  }

  /**
   * The playout policy (§6.3): with probability 0.5 take a capture if one exists; otherwise a
   * uniformly random legal point that is not the mover's own eye. -1 = pass (no such point).
   */
  randomMove(rng: () => number): number {
    const { buffer } = this;
    if (rng() < 0.5) {
      const found = this.captureMoves(buffer);
      if (found > 0) return buffer[Math.min(found - 1, Math.floor(rng() * found))];
    }
    let empties = 0;
    for (let c = 0; c < this.count; c++) if (this.cells[c] === EMPTY) buffer[empties++] = c;
    while (empties > 0) {
      const i = Math.min(empties - 1, Math.floor(rng() * empties));
      const cell = buffer[i];
      if (!this.isOwnEye(cell, this.toPlay) && this.isLegal(cell)) return cell;
      buffer[i] = buffer[--empties];
    }
    return -1;
  }

  /** Plays random moves until two passes in a row or `maxPlies` plies on this board. */
  playout(rng: () => number, maxPlies: number): void {
    while (this.plies < maxPlies && this.passes < 2) {
      const cell = this.randomMove(rng);
      if (cell < 0) this.pass();
      else this.play(cell);
    }
  }

  /**
   * Chinese area score without dead-stone removal, like the engine's `score(board, {komi})`:
   * Black's total minus White's total including komi (> 0: Black wins).
   */
  areaDifference(komi: number): number {
    const { cells, adj, seen, stack } = this;
    const scan = ++this.seenMark;
    let black = 0;
    let white = 0;
    for (let start = 0; start < this.count; start++) {
      const v = cells[start];
      if (v === 1) black++;
      else if (v === 2) white++;
      if (v !== EMPTY || seen[start] === scan) continue;
      let sp = 0;
      stack[sp++] = start;
      seen[start] = scan;
      let region = 0;
      let borders = 0;
      while (sp > 0) {
        const c = stack[--sp];
        region++;
        for (let k = c * 4, end = k + 4; k < end; k++) {
          const n = adj[k];
          if (n < 0) continue;
          const w = cells[n];
          if (w === EMPTY) {
            if (seen[n] !== scan) {
              seen[n] = scan;
              stack[sp++] = n;
            }
          } else {
            borders |= w;
          }
        }
      }
      if (borders === 1) black += region;
      else if (borders === 2) white += region;
    }
    return black - white - komi;
  }
}

function contains(list: Int16Array, length: number, value: number): boolean {
  for (let i = 0; i < length; i++) if (list[i] === value) return true;
  return false;
}
